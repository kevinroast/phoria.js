define([
  'phoria-namespace', 'phoria-util', 'entities/phoria-base-entity', 
  'entities/phoria-entity', 'entities/phoria-physics-entity', 'entities/phoria-positional-aspect',
  'phoria-gl-matrix'], 
  function(Phoria, Util, BaseEntity, Entity, PhysicsEntity, PositionalAspect, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.BaseEntity = BaseEntity;
  Phoria.Entity = Entity;
  Phoria.PhysicsEntity = PhysicsEntity;
  Phoria.PositionalAspect = PositionalAspect;

  var vec2     = PhoriaGlMatrix.vec2,
      vec3     = PhoriaGlMatrix.vec3,
      vec4     = PhoriaGlMatrix.vec4,
      mat2     = PhoriaGlMatrix.mat2,
      mat3     = PhoriaGlMatrix.mat3,
      mat4     = PhoriaGlMatrix.mat4,
      mat2d    = PhoriaGlMatrix.mat2d,
      quat     = PhoriaGlMatrix.quat,
      glMatrix = PhoriaGlMatrix.glMatrix;

  (function() {
     "use strict";

     /**
      * Emitter is used to generate "particle" physics entities at a given rate per second with a flexible configuration
      * of velocity and position starting point. The emitter itself is not rendered, but exposes a style config that is
      * applied to all child particle entities. An event handler 'onParticle' is provided to allow further customisation
      * of particles as they are generated.
      */
     Phoria.EmitterEntity = function()
     {
        Phoria.EmitterEntity.superclass.constructor.call(this);

        this.position = {x:0,y:0,z:0};
        this.positionRnd = {x:0,y:0,z:0};
        this.velocity = {x:0,y:1,z:0};
        this.velocityRnd = {x:0,y:0,z:0};
        this.maximum = 1000;
        this.gravity = true;
        
        // default particle rendering style
        var style = Phoria.Entity.createStyle();
        style.drawmode = "point";
        style.shademode = "plain";
        style.geometrysortmode = "none";
        style.linewidth = 5;
        style.linescale = 2;
        this.style = style;
        
        this.textures = [];
        
        this._lastEmitTime = Date.now();
        
        // add handler to emit particles
        this.onScene(this.emitParticles);
        
        return this;
     };
     
     /**
      * Factory create method - object literal Entity descripton:
      * {
      *    position: {x:0,y:0,z:0},    // used as the start position for particles - default (0,0,0)
      *    positionRnd: {x:0,y:0,z:0}, // randomness to apply to the start position - default (0,0,0)
      *    rate: Number,               // particles per second to emit - default 0
      *    maximum: Number,            // maximum allowed particles (zero for unlimited) - default 1000
      *    velocity: {x:0,y:1,z:0},    // start velocity of the particle - default (0,1,0)
      *    velocityRnd: {x:0,y:0,z:0}, // randomness to apply to the velocity - default (0,0,0)
      *    lifetime: Number,           // lifetime in ms of the particle (zero for unlimited) - default 0
      *    lifetimeRnd: Number,        // lifetime randomness to apply - default 0
      *    gravity: boolean            // true to apply gravity to particles - default true
      *    style: {...}                // particle rendering style (@see Phoria.Entity)
      *    onParticle: function() {...}// particle create callback function
      * }
      */
     Phoria.EmitterEntity.create = function create(desc)
     {
        // TODO: provide an emitter() callback function - which could be used to apply velocity or whatever
        //       rather than assuming all particle generation will use the parameters below
        // merge structures to generate entity
        var e = new Phoria.EmitterEntity();
        Phoria.BaseEntity.create(desc, e);
        if (desc.position) e.position = desc.position;
        if (desc.positionRnd) e.positionRnd = desc.positionRnd;
        if (desc.rate) e.rate = desc.rate;
        if (desc.maximum) e.maximum = desc.maximum;
        if (desc.velocity) e.velocity = desc.velocity;
        if (desc.velocityRnd) e.velocityRnd = desc.velocityRnd;
        if (desc.lifetime) e.lifetime = desc.lifetime;
        if (desc.lifetimeRnd) e.lifetimeRnd = desc.lifetimeRnd;
        if (desc.gravity !== undefined) e.gravity = desc.gravity;
        if (desc.style) Phoria.Util.combine(e.style, desc.style);
        if (desc.onParticle) e.onParticle(desc.onParticle);
        
        return e;
     };
     
     Phoria.Util.extend(Phoria.EmitterEntity, Phoria.BaseEntity, {
        // {Object} style description for the entity - merged with the default style as defined in the constructor
        style: null,
        
        // {Number} output rate of the emitter in items per second
        rate: 0,
        
        // {Number} optional maximum number of particles allowed as children of the emitter
        maximum: 0,
        
        // {xyz} start velocity of the particles
        velocity: null,
        
        // {xyz} randomness to apply to the start velocity to particles
        velocityRnd: null,
        
        // {Number} lifetime of the particles in miliseconds 
        lifetime: 0,
        
        // {Number} randomness to apply to the lifetime of the particles
        lifetimeRnd: 0,
        
        // {boolean} true to automatically apply gravity force to the particles, false otherwise
        gravity: false,
        
        _lastEmitTime: 0,

        onParticleHandlers: null,
        
        /**
         * Add an onParticle event handler function to the entity. Typically used to decorate or modify a particle
         * before it is added to the emitter child list and begins it's lifecycle.
         * 
         * @param fn {function}    onParticle handler signature: function(particle) this = Phoria.EmitterEntity,
         *                         accepts [] of functions also
         */
        onParticle: function onParticle(fn)
        {
           if (this.onParticleHandlers === null) this.onParticleHandlers = [];
           this.onParticleHandlers = this.onParticleHandlers.concat(fn);
        },
        
        /**
         * Scene handler to generate child particles from the emitter.
         */
        emitParticles: function emitParticles(scene, matLocal, time)
        {
           // update worldposition position of emitter by local transformation -> world
           this.updatePosition(matLocal);
           
           // TODO: currently this assumes all direct children of the emitter are particles
           //       if they are not - this calculation needs to be changed to keep track.
           
           // clean up expired particles - based on lifetime
           var now = Date.now();
           for (var i=0, p; i<this.children.length; i++)
           {
              p = this.children[i];
              if (p._gravetime && now > p._gravetime)
              {
                 // found a particle to remove
                 this.children.splice(i, 1);
              }
           }
           
           // emit particle objects
           var since = now - this._lastEmitTime;
           var count = Math.floor((this.rate / 1000) * since);
           if (count > 0)
           {
              // emit up to count value - also checking maximum to ensure total particle count is met
              for (var c=0; c<count && (this.maximum === 0 || this.children.length < this.maximum); c++)
              {
                 var pos = {x:this.position.x, y:this.position.y, z:this.position.z};
                 pos.x += (Math.random() * this.positionRnd.x) - (this.positionRnd.x * 0.5);
                 pos.y += (Math.random() * this.positionRnd.y) - (this.positionRnd.y * 0.5);
                 pos.z += (Math.random() * this.positionRnd.z) - (this.positionRnd.z * 0.5);
                 var vel = {x:this.velocity.x, y:this.velocity.y, z:this.velocity.z};
                 vel.x += (Math.random() * this.velocityRnd.x) - (this.velocityRnd.x * 0.5);
                 vel.y += (Math.random() * this.velocityRnd.y) - (this.velocityRnd.y * 0.5);
                 vel.z += (Math.random() * this.velocityRnd.z) - (this.velocityRnd.z * 0.5);
                 
                 // create particle directly - avoid overhead of the more friendly factory method
                 var particle = new Phoria.PhysicsEntity();
                 particle.position = pos;
                 particle.points = [ pos ];
                 particle.velocity = vel;
                 particle.gravity = this.gravity;
                 particle.style = this.style;
                 particle.textures = this.textures;
                 if (this.lifetime !== 0)
                 {
                    particle._gravetime = Math.floor(now + this.lifetime + (this.lifetimeRnd * Math.random()) - this.lifetimeRnd*0.5);
                 }
                 
                 // execute any callbacks interested in the particle creation
                 if (this.onParticleHandlers !== null)
                 {
                    for (var h=0; h<this.onParticleHandlers.length; h++)
                    {
                       this.onParticleHandlers[h].call(this, particle);
                    }
                 }
                 
                 this.children.push(particle);
              }
              this._lastEmitTime = now;
           }
        }
     });
     Phoria.Util.augment(Phoria.EmitterEntity, Phoria.PositionalAspect);
  })();

  return Phoria.EmitterEntity;

});