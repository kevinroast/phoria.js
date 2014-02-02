/**
 * @fileoverview phoria - Scene controller, manages camera and perspective matrices and scene graph.
 * @author Kevin Roast
 * @date 14th April 2013
 */

(function() {
   "use strict";

   /**
    * Scene encapsulates the meta-data that describes the 3D scene, including the camera, perspective transformation and the
    * viewport size information. It maintains the scene graph of Entity object to process during each scene step. Also provides
    * an event handler 'onCamera' as a hook point for manual modification of the scene data before each rendering cycle.
    * 
    * Typically the scene is setup once via the constructor or factory create helper method below, then an animation function
    * would call the modelView() method during each animation loop. The modelView() function will execute the transformation
    * pipeline applying model view matrix to all entities and preparing a flattened list of objects to be rendered by a renderer.
    * A render such as CanvasRenderer will then be passed the current scene for output: renderer.render(scene) 
    */
   Phoria.Scene = function()
   {
      // set scene defaults
      this.camera = {
         // up vector
         up: {x:0.0, y:1.0, z:0.0},
         // look at location
         lookat: {x:0.0, y:0.0, z:0.0},
         // position of the viewer
         position: {x:0.0, y:0.0, z:-10.0}
      };
      
      this.perspective = {
         // vertical field-of-view in degrees NOTE: converted to Phoria.RADIANS for mat4.perspective()
         fov: 35.0,
         // aspect ratio of the view plane
         aspect: 1.0,
         // near bound of the frustum
         near: 1.0,
         // far bound of the frustum
         far: 10000.0
      };
      
      // typically this is set to the width and height of the canvas rendering area
      this.viewport = {
         x: 0,
         y: 0,
         width: 1024,
         height: 1024
      };
      
      this.graph = [];
      this.triggerHandlers = [];

      return this;
   };

   /**
    * Factory create method - object literal Scene descripton:
    * {
    *    camera: {
    *       up: {x:0.0, y:1.0, z:0.0},
    *       lookat: {x:0.0, y:0.0, z:0.0},
    *       position: {x:0.0, y:0.0, z:-10.0},
    *    },
    *    perspective: {
    *       fov: 35.0,
    *       aspect: 1.0,
    *       near: 1.0,
    *       far: 10000.0
    *    },
    *    viewport: {
    *       x: 0,
    *       y: 0,
    *       width: 1024,
    *       height: 1024
    *    },
    *    graph: [...],
    *    onCamera: function() {...} << or [] of function defs
    */
   Phoria.Scene.create = function(desc)
   {
      // merge object structures to generate scene
      var s = new Phoria.Scene();
      if (desc.camera) s.camera = Phoria.Util.merge(s.camera, desc.camera);
      if (desc.perspective) s.perspective = Phoria.Util.merge(s.perspective, desc.perspective);
      if (desc.viewport) s.viewport = Phoria.Util.merge(s.viewport, desc.viewport);
      if (desc.graph) s.graph = desc.graph;
      if (desc.onCamera) s.onCamera(desc.onCamera);
      
      return s;
   };

   /**
    * Deserialise a scene instance from a JSON structure. All phoria.js scene and child entity objects can be
    * represented as a straight conversion from JSON to JavaScript - the only caveat being event handler function
    * definitions (such as onScene, onCamera, onParticle etc.) are serialised as string values. This helper will
    * walk the resulting entity structure looking for those methods and eval() them into runtime functions.
    * 
    * @param json    JSON string containing a serialised scene description.
    * @return Phoria.Scene
    * @throws Error on failure to parse scene or failure to eval runtime functions
    * 
    * TODO: Unfinished!
    */
   Phoria.Scene.createFromJSON = function(json)
   {
      var scene = null;

      // the object version of the parsed JSON is still just a set of basic JS object literals
      // we need to construct the Phoria objects that represent the scene and entities in the scene graph
      // each entity needs to be processed recursively to ensure all children are constructed also
      var jscene = JSON.parse(json);
      if (jscene)
      {
         // found a scene object
         // firstly, convert any event handler serialised functions to runtime functions

         // now construct Phoria.Scene
         //scene = 
         /*if (jscene.onCamera instanceof string)
         {
            jscene.onCamera = eval(jscene.onCamera)
         }*/
         if (jscene.graph)
         {
            var fnProcessEntities = function(entities) {
               for (var i = 0, e; i < entities.length; i++)
               {
                  e = entities[i];

                  // iterate property names
                  for (var p in e)
                  {
                     if (e.hasOwnProperty(p))
                     {
                        // if property name matches with "on*" it's an event handler (or list of) by convention
                        // TODO: support array of event handler functions in object structure
                        //       the various Phoria Entity objects now support function or array of function passed to on event
                        if (p.indexOf("on") === 0 && (e[p] instanceof string || e[p] instanceof Array))
                        {
                           try
                           {
                              // TODO: convert string to function or array of strings to array of functions
                           }
                           catch (error)
                           {
                              console.log("Failed to convert expected event handler to function: " + p + "=" + e[p]);
                              throw error;
                           }
                        }
                        if (p === "children" && e[p] instanceof Array)
                        {
                           fnProcessEntities(e[p]);
                        }
                     }
                  }

                  // TODO: construct our Phoria entity from the object structure
               }
            };
            fnProcessEntities(jscene.graph);
         }
      }

      return scene;
   };

   /**
    * TODO: Unfinished!
    */
   Phoria.Scene.toJSON = function(scene)
   {
      /*if (scene.onCamera)
      {
         scene.onCamera = scene.onCamera.toString();
      }*/
      for (var p in scene)
      {
         if (scene.hasOwnProperty(p) && p.indexOf("_") === 0)
         {
            // remove private property/function before serialisation
            delete scene[p];
         }
      }
      if (scene.graph)
      {
         var fnProcessEntities = function(entities) {
            for (var i = 0, e; i < entities.length; i++)
            {
               e = entities[i];
               // iterate property names
               for (var p in e)
               {
                  if (e.hasOwnProperty(p))
                  {
                     // if property name matches "on*Handlers" it is an event handler function list by convention
                     if (p.indexOf("on") === 0 && e[p] instanceof Array)
                     {
                        e[p] = e[p].toString();
                     }

                     // TODO: modify all Phoria entity classes to correctly mark private vars with "_"

                     if (p.indexOf("_") === 0)
                     {
                        // remove private property/function before serialisation
                        delete e[p];
                     }
                     switch (p)
                     {
                        case "textures":
                           delete e[p];
                           break;
                        
                        case "children":
                           if (e[p] instanceof Array)
                           {
                              fnProcessEntities(e[p]);
                           }
                           break;
                     }
                  }
               }

               // TODO: need to serialise the Entity type into the object structure!
            }
         };
         fnProcessEntities(scene.graph);
      }

      return JSON.stringify(scene);
   };
   
   Phoria.Scene.prototype = {
      // {Object} camera - converts values to vec3 to generate camera matrix
      camera: null,
      
      // {Object} the near/far values are distances from the camera view plane, and are always positive.
      // the perspective frustrum moves with the viewer
      perspective: null,
      
      // {Array} manipulate 3D entity graph directly e.g. push/delete objects
      graph: null,

      // {Object} dimensions of viewport for NDC->viewport conversion step
      viewport: null,

      // @readonly {Array} the flattened, sorted list of entities for rendering a frame of the scene - set by modelView()
      renderlist: null,

      // @readonly {Array} the light entities that were found when processing the scene graph - set by modelView()
      lights: null,
      
      // {Array} list of objects containing a "trigger" function that is executed once per frame.
      // Each trigger can affect the scene at runtime and if needed expire the event handler from the active list
      // or add new trigger(s) with additional logic to continue a sequence of triggers and events.
      triggerHandlers: null,
      
      // @private {Array} list of onCamera event handler functions to be called on each frame - added via "onCamera()"
      onCameraHandlers: null,

      // @private {Object} map of entity IDs to Phoria.Entity instances - flattened lookup list used by trigger handlers
      // to lookup an entity without walking child lists or maintaining closure scope etc. Call findEntity() to use.
      _entities: null,

      _lastTime: 0,
      _cameraPosition: null,        // current camera position as vec4
      _perspectiveScale: 0.0,

      /**
       * Helper to lookup an entity by it's optional ID. Useful for Trigger event handlers that don't
       * want to walk complex trees of entities during event handler functions.
       * 
       * @param id {string}      ID of the entity to lookup
       * @return Phoria.Entity or null if not found
       */
      findEntity: function findEntity(id)
      {
         return this._entities[id];
      },

      /**
       * Add an onCamera event handler function to the entity
       * 
       * @param fn {function}    onCamera handler signature: function(position, lookAt, up) this = scene,
       *                         accepts [] of functions also
       */
      onCamera: function onCamera(fn)
      {
         if (this.onCameraHandlers === null) this.onCameraHandlers = [];
         this.onCameraHandlers = this.onCameraHandlers.concat(fn);
      },
      
      /**
       * Execute the transformation pipeline for applying model view matrix to all entities
       * 
       * This method is responsible for:
       * . Setting up Camera and Perspective matrices based on the scene description
       * . Applying local transformations - with respect to parent child relationships to each entity in the scene
       * . Applying the camera and perspective transformation matrices to each entity
       * . Sort entity points/edges/polygons by Z order
       * . Perspective division to create Normalised Device Coordinates then finally transform to viewport
       * . Clipping calculations occurs before the viewport transform to mark vertices as "clipped" for rendering
       * . Lighting transformations for polygon normal vectors
       */
      modelView: function modelView()
      {
         // time since last update in seconds
         var now = Date.now(),
             time = (now - this._lastTime) / 1000;
         this._lastTime = now;
         
         // prerender steps that are performed on each frame before objects are processed - setup matrices etc.
         
         // viewport size and offset details
         var vpx = this.viewport.x,
             vpy = this.viewport.y,
             vpw = this.viewport.width * 0.5,
             vph = this.viewport.height * 0.5;
         
         // store current camera position as vec4 - useful for specular lighting calculations later
         this._cameraPosition = vec4.fromValues(
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
            0);
         var camera = mat4.create(),
             cameraLookat = vec4.fromValues(
               this.camera.lookat.x,
               this.camera.lookat.y,
               this.camera.lookat.z,
               0),
             cameraUp = vec4.fromValues(
               this.camera.up.x,
               this.camera.up.y,
               this.camera.up.z,
               0);
         
         // hook point to allow processing of the camera vectors before they are applied to the lookAt matrix
         // e.g. rotate the camera position around an axis
         // another way to do this would be to perform this step manually at the start of an animation loop
         if (this.onCameraHandlers !== null)
         {
            for (var h=0; h<this.onCameraHandlers.length; h++)
            {
               this.onCameraHandlers[h].call(this, this._cameraPosition, cameraLookat, cameraUp);
            }
         }

         // generate the lookAt matrix
         mat4.lookAt(
            camera,
            this._cameraPosition,
            cameraLookat,
            cameraUp);
         
         // calculate perspective matrix for our scene
         var perspective = mat4.create();
         mat4.perspective(
            perspective,
            -this.perspective.fov * Phoria.RADIANS,
            this.perspective.aspect,
            this.perspective.near,
            this.perspective.far);
         // scaling factor used when rendering points to account for perspective fov
         this._perspectiveScale = (256 - this.perspective.fov) / 16;
         
         // process each object in the scene graph
         // and recursively process each child entity (against parent local matrix)
         var renderlist = [],
             lights = [],
             entityById = {};
         
         // recursive processing function - keeps track of current matrix operation
         var fnProcessEntities = function processEntities(entities, matParent)
         {
            for (var n=0, obj, len, isIdentity; n<entities.length; n++)
            {
               obj = entities[n];

               // check disabled flag for this entity
               if (obj.disabled) continue;

               // construct entity lookup list by optional ID
               // used to quickly lookup entities in event handlers without walking child lists etc.
               if (obj.id) entityById[obj.id] = obj;
               
               // hook point for onBeforeScene event handlers - custom user handlers or added by entities during
               // object construction - there can be multiple registered per entity
               if (obj.onBeforeSceneHandlers !== null)
               {
                  for (var h=0; h<obj.onBeforeSceneHandlers.length; h++)
                  {
                     obj.onBeforeSceneHandlers[h].call(obj, this, time);
                  }
               }

               // multiply local with parent matrix to combine affine transformations
               var matLocal = obj.matrix;
               if (matParent)
               {
                  // if parent matrix is provided multiply it against local matrix else use the parent matrix
                  matLocal = matLocal ? mat4.multiply(mat4.create(), matLocal, matParent) : matParent;
               }
               
               // hook point for onScene event handlers - custom user handlers or added by entities during
               // object construction - there can be multiple registered per entity
               if (obj.onSceneHandlers !== null)
               {
                  for (var h=0; h<obj.onSceneHandlers.length; h++)
                  {
                     obj.onSceneHandlers[h].call(obj, this, matLocal, time);
                  }
               }
               
               if (obj instanceof Phoria.BaseLight)
               {
                  lights.push(obj);
               }
               else if (obj instanceof Phoria.Entity)
               {
                  len = obj.points.length;
                  
                  // pre-create or reuse coordinate buffers for world, screen, normal and clip coordinates
                  obj.initCoordinateBuffers();
                  
                  // set-up some values used during clipping calculations
                  var objClip = 0,
                      clipOffset = 0;
                  if (obj.style.drawmode === "point")
                  {
                     // adjust vec by style linewidth calculation for linewidth scaled points or sprite points
                     // this allows large sprite/rendered points to avoid being clipped too early
                     if (obj.style.linescale === 0)
                     {
                        clipOffset = obj.style.linewidth * 0.5;
                     }
                     else
                     {
                        clipOffset = (obj.style.linewidth * obj.style.linescale) / this._perspectiveScale * 0.5;
                     }
                  }
                  
                  // main vertex processing loop
                  for (var v=0, verts, vec, w, avz=0; v<len; v++)
                  {
                     // construct homogeneous coordinate for the vertex as a vec4
                     verts = obj.points[v];
                     vec = vec4.set(obj._worldcoords[v], verts.x, verts.y, verts.z, 1.0);
                     
                     // local object transformation -> world space
                     // skip local transform if matrix not present
                     // else store locally transformed vec4 world points
                     if (matLocal) vec4.transformMat4(obj._worldcoords[v], vec, matLocal);
                     
                     // multiply by camera matrix to generate camera space coords
                     vec4.transformMat4(obj._cameracoords[v], obj._worldcoords[v], camera);
                     
                     // multiply by perspective matrix to generate perspective and clip coordinates
                     vec4.transformMat4(obj._coords[v], obj._cameracoords[v], perspective);
                     
                     // perspective division to create vec2 NDC then finally transform to viewport
                     // clip calculation occurs before the viewport transform
                     vec = obj._coords[v];
                     w = vec[3];
                     
                     // stop divide by zero
                     if (w === 0) w = Phoria.EPSILON;
                     
                     // is this vertex outside the clipping boundries for the perspective frustum?
                     objClip += (obj._clip[v] = (vec[0] > w+clipOffset || vec[0] < -w-clipOffset ||
                                                 vec[1] > w+clipOffset || vec[1] < -w-clipOffset ||
                                                 vec[2] > w || vec[2] < -w) ? 1 : 0);
                     
                     // perspective division
                     vec[0] /= w;
                     vec[1] /= w;
                     // Z is used by coarse object depth sort
                     
                     // linear transform to viewport - could combine with division above - but for clarity it is not
                     vec[0] = vpw * vec[0] + vpx + vpw;
                     vec[1] = vph * vec[1] + vpy + vph;
                     
                     // keep track of average Z here as it's no overhead and it's useful for rendering
                     avz += vec[2];
                  }
                  // store average Z coordinate
                  obj._averagez = len > 1 ? avz/len : avz;
                  
                  // if entire object is clipped, do not bother with final steps or adding to render list
                  if (objClip !== len)
                  {
                     // sort the geometry before any further transformations
                     switch (obj.style.geometrysortmode)
                     {
                        default:
                        case "automatic":
                        case "sorted":
                        {
                           // solid objects always need sorting as each poly can be a different shade/texture
                           // wireframe and points objects will not be sorted if the "plain" shademode is used
                           if (obj.style.geometrysortmode === "sorted" ||
                               obj.style.drawmode === "solid" || obj.style.shademode === "lightsource")
                           {
                              switch (obj.style.drawmode)
                              {
                                 case "solid":
                                    Phoria.Util.sortPolygons(obj.polygons, obj._cameracoords);
                                    break;
                                 case "wireframe":
                                    Phoria.Util.sortEdges(obj.edges, obj._cameracoords);
                                    break;
                                 case "point":
                                    Phoria.Util.sortPoints(obj._coords, obj._worldcoords);
                                    break;
                              }
                           }
                           break;
                        }
                     }

                     // normal lighting transformation
                     if (obj.style.drawmode === "solid" && obj.polygons.length !== 0)
                     {
                        // TODO: have a flag on scene for "transposedNormalMatrix..." - i.e. make it optional?
                        // invert and transpose the local model matrix - for correct normal scaling
                        var matNormals = mat4.invert(mat4.create(), matLocal ? matLocal : mat4.create());
                        mat4.transpose(matNormals, matNormals);
                        
                        switch (obj.style.shademode)
                        {
                           case "lightsource":
                           {
                              // transform each polygon normal
                              for (var i=0, normal, wnormal; i<obj.polygons.length; i++)
                              {
                                 if (!obj.polygons[i]._worldnormal) obj.polygons[i]._worldnormal = vec4.create();
                                 
                                 // normal transformation -> world space
                                 normal = obj.polygons[i].normal;
                                 wnormal = obj.polygons[i]._worldnormal;
                                 // use vec3 to ensure normal directional component is not modified
                                 vec3.transformMat4(wnormal, normal, matNormals);
                                 vec3.normalize(wnormal, wnormal);
                              }
                              break;
                           }
                           /*
                           case "gouraud":
                           {
                              // transform each vertex normal
                              for (var i=0, normal, wnormal; i<len; i++)
                              {
                                 normal = obj._vertexNormals[i];
                                 wnormal = obj._worldVertexNormals[i];
                                 vec4.transformMat4(wnormal, normal, matNormals);
                                 vec4.normalize(wnormal, wnormal);
                              }
                              break;
                           }
                           */
                        }
                     }
                     
                     // add to the flattened render list
                     renderlist.push(obj);
                  }
               } // end entity processing
               
               // recursively process children
               if (obj.children && obj.children.length !== 0)
               {
                  fnProcessEntities.call(this, obj.children, matLocal);
               }
               
            } // end entity list loop
         };
         fnProcessEntities.call(this, this.graph, null);

         // set the public references to the flattened list of objects to render and the list of lights
         this.renderlist = renderlist;
         this.lights = lights;
         this._entities = entityById;

         // Process the scene trigger functions - this allows for real-time modification of the scene
         // based on a supplied handler function - a sequence of these triggers can nest and add new
         // triggers causing a sequence of events to perform chained actions to the scene as it executes.
         // Uses a for(...) loop to allow add/remove mods to the list during event processing.
         for (var t=0, len = this.triggerHandlers.length; t<len; t++)
         {
            // trigger handlers return true if they are finished i.e. no longer needed in the scene
            if (this.triggerHandlers[t].trigger.call(this, this._cameraPosition, cameraLookat, cameraUp))
            {
               this.triggerHandlers.splice(t, 1);
               len--;
            }
         }
      }
   };
})();
