/**
 * @fileoverview phoria - 3D Entity objects. Base class for chained matrix operations. Concrete Entity implementations.
 * @author Kevin Roast
 * @date 13th April 2013
 */

(function() {
   "use strict";
   
   /**
    * BaseEntity is the base that other Entity prototypes extend from. Provides functions to perform chained matrix
    * operations and maintains the child entity list. It also provides the onScene event handler functions.
    */
   Phoria.BaseEntity = function()
   {
      // the model matrix for this object - live manipulation functions below
      this.matrix = mat4.create();
      this.children = [];
      
      return this;
   };
   
   /**
    * Factory create method - object literal Entity descripton:
    * {
    *    id: string,
    *    matrix: mat4,
    *    children: [...],
    *    onBeforeScene: function() {...},
    *    onScene: function() {...},
    *    disabled: boolean
    * }
    */
   Phoria.BaseEntity.create = function create(desc, e)
   {
      // merge structures to generate entity
      if (!e) e = new Phoria.BaseEntity();
      if (desc.id) e.id = desc.id;
      if (desc.matrix) e.matrix = desc.matrix;
      if (desc.children) e.children = desc.children;
      if (desc.onBeforeScene) e.onBeforeScene(desc.onBeforeScene);
      if (desc.onScene) e.onScene(desc.onScene);
      if (desc.disabled !== undefined) e.disabled = desc.disabled;
      
      return e;
   };
   
   Phoria.BaseEntity.prototype =
   {
      // {string} optional unique ID for direct look-up of entity during event handlers etc.
      id: null,

      // {Array} child objects for the purposes of affine transformations - parent matrix applied first
      // the child objects themselves can of course have further child objects
      children: null,
      
      // {mat4} matrix to be applied to the entity during scene processing
      matrix: null,

      // {boolean} set to true to disable processing of the Entity and all child entities during the modelView pipeline
      disabled: false,
      
      onBeforeSceneHandlers: null,
      onSceneHandlers: null,
      
      /**
       * Add an onBeforeSceneHandlers event handler function to the entity. Called at the start of each scene
       * processing cycle before the local matrix has been multipled by the parent matrix.
       * 
       * @param fn {function}    onBeforeSceneHandlers handler signature: function(Phoria.Scene, time) this = Phoria.Entity,
       *                         accepts [] of functions also
       */
      onBeforeScene: function onBeforeScene(fn)
      {
         if (this.onBeforeSceneHandlers === null) this.onBeforeSceneHandlers = [];
         this.onBeforeSceneHandlers = this.onBeforeSceneHandlers.concat(fn);
      },

      /**
       * Add an onScene event handler function to the entity. Called at the start of each scene processing cycle after the
       * local matrix has been multiplied by the parent matrix. 
       * 
       * @param fn {function}    onScene handler signature: function(Phoria.Scene, matLocal, time) this = Phoria.Entity,
       *                         accepts [] of functions also
       */
      onScene: function onScene(fn)
      {
         if (this.onSceneHandlers === null) this.onSceneHandlers = [];
         this.onSceneHandlers = this.onSceneHandlers.concat(fn);
      },

      identity: function identity()
      {
         mat4.identity(this.matrix);
         return this;
      },

      invert: function invert()
      {
         mat4.invert(this.matrix, this.matrix);
         return this;
      },

      multiply: function multiply(m)
      {
         mat4.multiply(this.matrix, this.matrix, m);
         return this;
      },

      scale: function scale(vec)
      {
         mat4.scale(this.matrix, this.matrix, vec);
         return this;
      },

      scaleN: function scale(n)
      {
         mat4.scale(this.matrix, this.matrix, vec3.fromValues(n,n,n));
         return this;
      },

      rotate: function rotate(rad, axis)
      {
         mat4.rotate(this.matrix, this.matrix, rad, axis);
         return this;
      },

      rotateX: function rotateX(rad)
      {
         mat4.rotateX(this.matrix, this.matrix, rad);
         return this;
      },

      rotateY: function rotateY(rad)
      {
         mat4.rotateY(this.matrix, this.matrix, rad);
         return this;
      },

      rotateZ: function rotateZ(rad)
      {
         mat4.rotateZ(this.matrix, this.matrix, rad);
         return this;
      },
      
      /**
       * Rotate entity matrix by the given yaw (heading), pitch (elevation) and roll (bank) Euler angles.
       * @param {Number} yaw the yaw/heading angle in radians
       * @param {Number} pitch the pitch/elevation angle in radians
       * @param {Number} roll the roll/bank angle in radians
       */
      rotateYPR: function rotateYPR(yaw, pitch, roll)
      {
         var m = mat4.fromYPR(yaw, pitch, roll);
         mat4.multiply(this.matrix, this.matrix, m);
      },

      translate: function translate(vec)
      {
         mat4.translate(this.matrix, this.matrix, vec);
         return this;
      },

      translateX: function translateX(n)
      {
         mat4.translate(this.matrix, this.matrix, vec3.fromValues(n,0,0));
         return this;
      },

      translateY: function translateY(n)
      {
         mat4.translate(this.matrix, this.matrix, vec3.fromValues(0,n,0));
         return this;
      },

      translateZ: function translateZ(n)
      {
         mat4.translate(this.matrix, this.matrix, vec3.fromValues(0,0,n));
         return this;
      },
      
      determinant: function determinant()
      {
         return mat4.determinant(this.matrix);
      },
      
      transpose: function transpose()
      {
         mat4.transpose(this.matrix, this.matrix);
         return this;
      }
   };
})();

Phoria.CLIP_ARRAY_TYPE = (typeof Uint32Array !== 'undefined') ? Uint32Array : Array;

(function() {
   "use strict";

   /**
    * Entity is the main Phoria 3D object class. It describes the vertices, edges, polygons and textures for a object
    * that can be rendered within a scene. Other classes sub-class this to provide more specialised entities such as
    * lights or Physics objects. The Entity also descibes a style structure that has a number of configuration settings
    * for different types and modes of rendering a 3D object.
    */
   Phoria.Entity = function()
   {
      Phoria.Entity.superclass.constructor.call(this);
      
      this.points = [];
      this.edges = [];
      this.polygons = [];
      this.textures = [];
      this.style = Phoria.Entity.createStyle();
      
      return this;
   };

   /**
    * Factory create method - object literal Entity descripton:
    * {
    *    points: [{x:0,y:0,z:0},...],
    *    edges: [{a:0,b:1},...],
    *    polygons: [{vertices:[7,8,10,9]},{vertices:[0,1,2],texture:0,uvs:[0,0,0.5,0.5,0.5,0]},...],
    *    style: {
    *       color: [128,128,128],      // RGB colour of the object surface
    *       specular: 0,               // if not zero, specifies specular shinyness power - e.g. values like 16 or 64
    *       diffuse: 1.0,              // material diffusion generally ranges from 0-1
    *       emit: 0.0,                 // material emission (glow) 0-1
    *       opacity: 1.0,              // material opacity 0-1
    *       drawmode: "solid",         // one of "point", "wireframe", "solid"
    *       shademode: "lightsource",  // one of "plain", "lightsource", "sprite", "callback" (only for point rendering)
    *       fillmode: "inflate",       // one of "fill", "filltwice", "inflate", "fillstroke", "hiddenline"
    *       objectsortmode: "sorted",  // coarse object sort - one of "sorted", "front", "back"
    *       geometrysortmode: "automatic",   // point, edge or polygon sorting mode - one of "sorted", "automatic", "none"
    *       linewidth: 1.0,            // wireframe line thickness
    *       linescale: 0.0,            // depth based scaling factor for wireframes - can be zero for no scaling
    *       doublesided: false,        // true to always render polygons - i.e. do not perform hidden surface test
    *       texture: undefined         // default texture index to use for polygons if not specified - e.g. when UVs are used
    *    },
    *    onRender: function() {...}
    * }
    */
   Phoria.Entity.create = function create(desc, e)
   {
      // merge structures to generate entity
      if (!e) e = new Phoria.Entity();
      Phoria.BaseEntity.create(desc, e);
      if (desc.points) e.points = desc.points;
      if (desc.polygons) e.polygons = desc.polygons;
      if (desc.edges) e.edges = desc.edges;
      if (desc.style) Phoria.Util.combine(e.style, desc.style);
      if (desc.onRender) e.onRender(desc.onRender);
      
      // generate normals - can call generate...() if manually changing points/polys at runtime
      e.generatePolygonNormals();
      // TODO: apply when gouraud shading for software rendering is added
      //e.generateVertexNormals();
      
      return e;
   };
   
   /**
    * Static helper to construct a default style object with all values populated.
    * 
    * @param s {Object}    Optional style object literal to merge into the default style.
    */
   Phoria.Entity.createStyle = function createStyle(s)
   {
      var style = {
         color: [128,128,128],
         diffuse: 1.0,
         specular: 0,
         drawmode: "solid",
         shademode: "lightsource",
         fillmode: "inflate",
         objectsortmode: "sorted",
         geometrysortmode: "automatic",
         linewidth: 1.0,
         linescale: 0.0,
         opacity: 1.0,
         doublesided: false
      };
      if (s) Phoria.Util.combine(style, s);
      return style;
   };
   
   Phoria.Util.extend(Phoria.Entity, Phoria.BaseEntity, {
      // {Array} list of {x:n,y:n,z:n} tuples describing the vertices of the entity
      points: null,
      
      // {Array} list of {a:n,b:n} objects describes the wireframe edges of the entity
      edges: null,
      
      // {Array} list of {vertices:[n,n,n,...],color:{r,g,b},texture:n} vertices array (minimum 3 per polygon) and
      // optional polygon color rgb tuple and optional texture index into the entity textures image list
      polygons: null,
      
      // {Object} style description for the entity - merged with the default style as defined in the constructor
      style: null,
      
      // {Array} list of texture images available to polygons
      textures: null,

      onRenderHandlers: null,
      
      _worldcoords: null,
      _cameracoords: null,
      _coords: null,
      _clip: null,
      _averagez: 0,
      _sorted: true,
      
      /**
       * Add an onRender event handler function to the entity. Called if shademode="callback" for custom rendering.
       * 
       * @param fn {function}    onRender handler signature: function(ctx, x, y, w) this = Phoria.Entity,
       *                         accepts [] of functions also
       */
      onRender: function onRender(fn)
      {
         if (this.onRenderHandlers === null) this.onRenderHandlers = [];
         this.onRenderHandlers = this.onRenderHandlers.concat(fn);
      },

      /**
       * Calculate and store the face normals for the entity
       */
      generatePolygonNormals: function generatePolygonNormals()
      {
         if (this.polygons)
         {
            // calculate normal vectors for face data - and set default colour
            // value if not supplied in the data set
            var points = this.points,
                polygons = this.polygons;
            for (var i=0, vertices, x1, y1, z1, x2, y2, z2; i<polygons.length; i++)
            {
               // First calculate normals from 3 points on the poly:
               // Vector 1 = Vertex B - Vertex A
               // Vector 2 = Vertex C - Vertex A
               vertices = polygons[i].vertices;
               x1 = points[vertices[1]].x - points[vertices[0]].x;
               y1 = points[vertices[1]].y - points[vertices[0]].y;
               z1 = points[vertices[1]].z - points[vertices[0]].z;
               x2 = points[vertices[2]].x - points[vertices[0]].x;
               y2 = points[vertices[2]].y - points[vertices[0]].y;
               z2 = points[vertices[2]].z - points[vertices[0]].z;
               // save the vec4 normal vector as part of the polygon data structure
               polygons[i].normal = Phoria.Util.calcNormalVector(x1, y1, z1, x2, y2, z2);
            }
         }
      },
      
      /**
       * Init all the buffers needed by the entity during scene pipeline processing.
       * Buffers are re-allocated if the number of coordinates in the entity changes.
       */
      initCoordinateBuffers: function initCoordinateBuffers()
      {
         var len = this.points.length;
         if (this._worldcoords === null || this._worldcoords.length < len)
         {
            this._worldcoords = new Array(len);
            for (var i=0; i<len; i++) this._worldcoords[i] = vec4.create();
         }
         if (this._cameracoords === null || this._cameracoords.length < len)
         {
            this._cameracoords = new Array(len);
            for (var i=0; i<len; i++) this._cameracoords[i] = vec4.create();
         }
         if (this._coords === null || this._coords.length < len)
         {
            this._coords = new Array(len);
            for (var i=0; i<len; i++) this._coords[i] = vec4.create();
         }
         if (this._clip === null || this._clip.length < len)
         {
            this._clip = new Phoria.CLIP_ARRAY_TYPE(len);
         }
      },
      
      /**
       * Return an object describing the bounding rectangle coordinates of the renderable object in screen coordinates.
       * @return an object with properties; minx, miny, maxx, maxy
       */
      getScreenBounds: function getScreenBounds()
      {
         var minx=10000,miny=10000,maxx=-10000,maxy=-10000;
         for (var i=0,p; i<this._coords.length; i++)
         {
            p = this._coords[i];
            if (p[0] < minx) minx = p[0];
            if (p[0] > maxx) maxx = p[0];
            if (p[1] < miny) miny = p[1];
            if (p[1] > maxy) maxy = p[1];
         }
         return {
            minx: minx,
            miny: miny,
            maxx: maxx,
            maxy: maxy
         };
      },
      
      /**
       * Return an object describing the bounding cube coordinates of the entity in world coordinates.
       * @return an object with properties; minx, miny, minz, maxx, maxy, maxz
       */
      getWorldBounds: function getWorldBounds()
      {
         var minx=10000,miny=10000,minz=10000,maxx=-10000,maxy=-10000,maxz=-10000;
         for (var i=0,p; i<this._worldcoords.length; i++)
         {
            p = this._worldcoords[i];
            if (p[0] < minx) minx = p[0];
            if (p[0] > maxx) maxx = p[0];
            if (p[1] < miny) miny = p[1];
            if (p[1] > maxy) maxy = p[1];
            if (p[2] < minz) minz = p[2];
            if (p[2] > maxz) maxz = p[2];
         }
         return {
            minx: minx,
            miny: miny,
            maxx: maxx,
            maxy: maxy,
            minz: minz,
            maxz: maxz
         };
      }
   });

   /**
    * Add debug information to an entity.
    * Debug config options:
    * {
    *    showId: boolean
    *    showAxis: boolean
    *    showPosition: boolean
    * }
    */
   Phoria.Entity.debug = function debug(entity, config)
   {
      // search child list for debug entity
      var id = "Phoria.Debug" + (entity.id ? (" "+entity.id) : "");
      var debugEntity = null;
      for (var i=0; i<entity.children.length; i++)
      {
         if (entity.children[i].id === id)
         {
            debugEntity = entity.children[i];
            break;
         }
      }
      
      // create debug entity if it does not exist
      if (debugEntity === null)
      {
         // add a child entity with a custom renderer - that renders text of the parent id at position
         debugEntity = new Phoria.Entity();
         debugEntity.id = id;
         debugEntity.points = [ {x:0,y:0,z:0} ];
         debugEntity.style = {
            drawmode: "point",
            shademode: "callback",
            geometrysortmode: "none",
            objectsortmode: "front"    // force render on-top of everything else
         };

         // config object - will be combined with input later
         debugEntity.config = {};

         debugEntity.onRender(function(ctx, x, y) {
            // render debug text
            ctx.fillStyle = "#333";
            ctx.font = "14pt Helvetica";
            var textPos = y;
            if (this.config.showId)
            {
               ctx.fillText(entity.id ? entity.id : "unknown - set Entity 'id' property", x, textPos);
               textPos += 16;
            }
            if (this.config.showPosition)
            {
               var p = entity.worldposition ? entity.worldposition : debugEntity._worldcoords[0];
               ctx.fillText("{x:" + p[0].toFixed(2) + ", y:" + p[1].toFixed(2) + ", z:" + p[2].toFixed(2) + "}", x, textPos);
            }
         });
         entity.children.push(debugEntity);

         // add visible axis geometry (lines) as children of entity for showAxis
         var fnCreateAxis = function(letter, vector, color) {
            var axisEntity = new Phoria.Entity();
            axisEntity.points = [ {x:0,y:0,z:0}, {x:2*vector[0],y:2*vector[1],z:2*vector[2]} ];
            axisEntity.edges = [ {a:0,b:1} ];
            axisEntity.style = {
               drawmode: "wireframe",
               shademode: "plain",
               geometrysortmode: "none",
               objectsortmode: "front",
               linewidth: 2.0,
               color: color
            };
            axisEntity.disabled = true;
            return axisEntity;
         };
         debugEntity.children.push(fnCreateAxis("X", vec3.fromValues(1,0,0), [255,0,0]));
         debugEntity.children.push(fnCreateAxis("Y", vec3.fromValues(0,1,0), [0,255,0]));
         debugEntity.children.push(fnCreateAxis("Z", vec3.fromValues(0,0,1), [0,0,255]));
      }

      // set the config
      Phoria.Util.combine(debugEntity.config, config);
      for (var i=0; i<debugEntity.children.length; i++)
      {
         debugEntity.children[i].disabled = !debugEntity.config.showAxis;
      }
   }

})();


(function() {
   "use strict";
   
   Phoria.PositionalAspect = {};
   
   /**
    * The PositionalAspect has defines a prototype for objects that may not be rendered directly (i.e. do not need
    * to have a visible entity) but do represent a position in the scene.
    * 
    * Augment a prototype with this aspect to provide an easy way to keep track of a it's position in the scene after
    * matrix transformations have occured. Examine worldposition at runtime (ensure not null) to get current position.
    * 
    * Set the initial position on object construction if the entity is not positioned at the origin by default.
    */
   Phoria.PositionalAspect.prototype =
   {
      // {xyz} the position of the entity
      position: null,
      // {vec4} the transformed world position of the entity
      worldposition: null,
      
      updatePosition: function updatePosition(matLocal)
      {
         // update worldposition position of emitter by local transformation -> world
         var vec = vec4.fromXYZ(this.position, 1);
         vec4.transformMat4(vec, vec, matLocal);
         this.worldposition = vec;
      }
   };
})();


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


(function() {
   "use strict";

   /**
    * BaseLight is the base that the Light classes extend from. Provides RGB color and light intensity properties.
    */
   Phoria.BaseLight = function()
   {
      Phoria.BaseLight.superclass.constructor.call(this);
      
      this.color = [1.0, 1.0, 1.0];
      this.intensity = 1.0;
      
      return this;
   };
   
   Phoria.Util.extend(Phoria.BaseLight, Phoria.BaseEntity, {
      // [r,g,b] - note! light colour component levels are specified from 0.0 - 1.0
      color: null,
      
      // {Number} light intensity typically between 0-1
      intensity: 0.0
   });
})();


(function() {
   "use strict";

   /**
    * DistantLight models an infinitely distant light that has no position only a normalised direction from which light eminates.
    */
   Phoria.DistantLight = function()
   {
      Phoria.DistantLight.superclass.constructor.call(this);
      
      // direction should be a normalised vector
      this.direction = {x:0, y:0, z:1};
      
      // add scene handler to transform the light direction into world direction
      this.onScene(this.transformToScene);
      
      return this;
   };
   
   /**
    * Factory create method - object literal Light descripton
    */
   Phoria.DistantLight.create = function create(desc)
   {
      // merge structures to generate entity
      var e = new Phoria.DistantLight();
      Phoria.BaseEntity.create(desc, e);
      if (desc.color) e.color = desc.color;
      if (desc.intensity) e.intensity = desc.intensity;
      if (desc.direction) e.direction = vec3.toXYZ(vec3.normalize(e.direction, vec3.fromXYZ(desc.direction)));
      
      return e;
   };
   
   Phoria.Util.extend(Phoria.DistantLight, Phoria.BaseLight, {
      // light direction
      direction: null,
      worlddirection: null,
      
      transformToScene: function transformToScene()
      {
         this.worlddirection = vec3.fromValues(
            -this.direction.x,
            -this.direction.y,
            -this.direction.z);
      }
   });
})();


(function() {
   "use strict";

   /**
    * PointLight models a light that has a position within the scene and from which light eminates in all directions
    * equally. These lights also have an attenuation which describes how the light falls off over distance. A number of
    * attentuation types are provided such as none (no fall-off over distance), linear (fall-off directly related to the
    * distance from the light) and squared (fall-off related to distance squared).
    */
   Phoria.PointLight = function()
   {
      Phoria.PointLight.superclass.constructor.call(this);
      
      this.position = {x: 0, y:0, z:-1};
      this.attenuation = 0.1;
      this.attenuationFactor = "linear";
      
      // add scene handler to transform the light position into world position
      this.onScene(this.transformToScene);
      
      return this;
   };
   
   /**
    * Factory create method - object literal Light descripton
    * {
    *    position: {x:0,y:0,z:0},
    *    color: [0-1,0-1,0-1],
    *    intensity: 0-1,
    *    attenuation: 0-1,
    *    attenuationFactor: "none"|"linear"|"squared"
    * }
    */
   Phoria.PointLight.create = function create(desc)
   {
      // merge structures to generate entity
      var e = new Phoria.PointLight();
      Phoria.BaseEntity.create(desc, e);
      if (desc.color) e.color = desc.color;
      if (desc.intensity) e.intensity = desc.intensity;
      if (desc.position) e.position = desc.position;
      if (desc.attenuation) e.attenuation = desc.attenuation;
      if (desc.attenuationFactor) e.attenuationFactor = desc.attenuationFactor;
      
      return e;
   };
   
   Phoria.Util.extend(Phoria.PointLight, Phoria.BaseLight, {
      // falloff
      attenuation: 0,
      attenuationFactor: null,
      
      transformToScene: function transformToScene(scene, matLocal, time)
      {
         // update worldposition position of light by local transformation -> world
         this.updatePosition(matLocal);
      }
   });
   Phoria.Util.augment(Phoria.PointLight, Phoria.PositionalAspect);
})();
