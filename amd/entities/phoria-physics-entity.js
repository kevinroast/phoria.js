define(['phoria-namespace', 'phoria-util', 'entities/phoria-base-entity', 
  'entities/phoria-entity', 'entities/phoria-positional-aspect', 'phoria-gl-matrix'], 
  function(Phoria, Util, BaseEntity, PositionalAspect, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.BaseEntity = BaseEntity;
  Phoria.PositionalAspect = PositionalAspect;

  (function() {
     "use strict";

     /**
      * PhysicsEntity builds on the basic entity class to provide very basic physics support. The entity maintains
      * a position and a velocity that can be manipulated via constant and impulse forces. It also optionally
      * applies gravity. After the physics calculations the entity matrix is updated to the new position.
      */
     Phoria.PhysicsEntity = function()
     {
        Phoria.PhysicsEntity.superclass.constructor.call(this);
        
        this.velocity = {x:0, y:0, z:0};
        this.position = {x:0, y:0, z:0};
        this._force = {x:0, y:0, z:0};
        this._acceleration = null;
        this.gravity = true;
        
        // add handlers to apply physics etc.
        this.onBeforeScene(this.applyPhysics);
        this.onScene(this.transformToScene);
        
        return this;
     };
     
     /**
      * Factory create method - object literal Entity descripton:
      * {
      *    velocity: {x:0,y:0,z:0},
      *    position: {x:0,y:0,z:0}, // NOTE: position is not render data - just informational for scene callbacks etc.
      *    force: {x:0,y:0,z:0},
      *    gravity: boolean
      * }
      */
     Phoria.PhysicsEntity.create = function create(desc)
     {
        // merge structures to generate entity
        var e = new Phoria.PhysicsEntity();
        Phoria.Entity.create(desc, e);
        if (desc.velocity) e.velocity = desc.velocity;
        if (desc.position) e.position = desc.position;
        if (desc.force) e._force = desc.force;
        if (desc.gravity !== undefined) e.gravity = desc.gravity;
        
        return e;
     };
     
     Phoria.Util.extend(Phoria.PhysicsEntity, Phoria.Entity, {
        // {xyz} current velocity of the entity
        velocity: null,
        
        // {boolean} true to automatically apply gravity force to the object, false otherwise
        gravity: false,
        
        _force: null,
        _acceleration: null,
        
        /**
         * Apply an impluse force to the entity
         * @param f {Object} xyz tuple for the force direction
         */
        impulse: function impulse(f)
        {
           this._acceleration = f;
        },
        
        /**
         * Apply a constant force to the entity
         * @param f {Object} xyz tuple for the force direction
         */
        force: function force(f)
        {
           this._force = f;
        },
        
        /**
         * Scene handler to apply basic physics to the entity.
         * Current velocity is updated by any acceleration that is set, by any constant
         * force that is set and also optionally by fixed gravity.
         */
        applyPhysics: function applyPhysics(scene)
        {
           /**
            * NOTE: Physics simulation is updated in real-time regardless of the FPS of
            *       the rest of the animation - set to ideal time (in secs) to avoid glitches
            */
           var time = 1000/60/1000;    // 60FPS in seconds
           var tt = time * time;
           
           // apply impulse force if set then reset it to none
           if (this._acceleration)
           {
              this.velocity.x += (this._acceleration.x * tt);
              this.velocity.y += (this._acceleration.y * tt);
              this.velocity.z += (this._acceleration.z * tt);
              this._acceleration = null;
           }
           // apply constant force
           if (this._force)
           {
              this.velocity.x += (this._force.x * tt);
              this.velocity.y += (this._force.y * tt);
              this.velocity.z += (this._force.z * tt);
           }
           // apply constant gravity force if activated
           if (this.gravity)
           {
              this.velocity.x += (Phoria.PhysicsEntity.GRAVITY.x * tt);
              this.velocity.y += (Phoria.PhysicsEntity.GRAVITY.y * tt);
              this.velocity.z += (Phoria.PhysicsEntity.GRAVITY.z * tt);
           }
           
           // apply current velocity to position
           this.translate(vec3.fromXYZ(this.velocity));
        },

        transformToScene: function transformToScene(scene, matLocal)
        {
           // local transformation -> world
           this.updatePosition(matLocal);
        }
     });
     Phoria.Util.augment(Phoria.PhysicsEntity, Phoria.PositionalAspect);
  })();

  /**
   * Constants
   */
  Phoria.PhysicsEntity.GRAVITY = {x:0, y:-9.8, z:0};

  return Phoria.PhysicsEntity;
});