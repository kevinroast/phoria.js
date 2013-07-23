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
         // vertical field-of-view in degrees NOTE: converted to radians for mat4.perspective()
         fov: 35.0,
         // aspect ratio of the view plane
         aspect: 1.0,
         // near bound of the frustum
         near: 1.0,
         // far bound of the frustum
         far: 1000.0
      };
      
      // typically this is set to the width and height of the canvas rendering area
      this.viewport = {
         x: 0,
         y: 0,
         width: 1024,
         height: 1024
      };
      
      this.graph = [];

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
    *       far: 1000.0
    *    },
    *    viewport: {
    *       x: 0,
    *       y: 0,
    *       width: 1024,
    *       height: 1024
    *    },
    *    graph: [...],
    *    onCamera: function() {...}
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

      // {Array} the flattened, sorted list of entities for rendering a frame of the scene - set by modelView()
      renderlist: null,

      // {Array} the light entities that were found when processing the scene graph - set by modelView()
      lights: null,
      
      _lastTime: 0,
      _cameraPosition: null,
      
      onCameraHandlers: null,
      
      /**
       * Add an onCamera event handler function to the entity
       * 
       * @param fn {function}    onCamera handler signature: function(camera, perspective) this = scene
       */
      onCamera: function onCamera(fn)
      {
         if (this.onCameraHandlers === null) this.onCameraHandlers = [];
         this.onCameraHandlers.push(fn);
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
         // we adjust the perceived time by dividing by the "ideal" time per frame we are aiming for i.e. 60fps
         // this allows the physics to update more or less correctly even if framerate changes during the scene
         var now = Date.now(),
             time = (now - this._lastTime),
             frameMultipler = time / (1000/60);
         time = time / frameMultipler * 0.001;
         this._lastTime = now;
         
         // prerender steps that are performed on each frame before objects are processed - setup matrices etc.
         
         // viewport size and offset details
         var vpx = this.viewport.x,
             vpy = this.viewport.y,
             vpw = this.viewport.width * 0.5,
             vph = this.viewport.height * 0.5;
         
         // calculate camera matrix for our scene
         var camera = mat4.create();
         // store current camera position as vec3 - useful for specular lighting calculations later
         this._cameraPosition = vec3.fromValues(
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z);
         mat4.lookAt(
            camera,
            this._cameraPosition,
            vec3.fromValues(
               this.camera.lookat.x,
               this.camera.lookat.y,
               this.camera.lookat.z),
            vec3.fromValues(
               this.camera.up.x,
               this.camera.up.y,
               this.camera.up.z));
         
         // calculate perspective matrix for our scene
         var perspective = mat4.create();
         mat4.perspective(
            perspective,
            -this.perspective.fov * RADIANS,
            this.perspective.aspect,
            this.perspective.near,
            this.perspective.far);
         
         // hook point to allow processing of the camera and perspective matrices before they are applied
         // e.g. mat4.rotate(camera, camera, Math.sin(Date.now()/10000)*RADIANS*360, vec3.fromValues(0,1,0));
         if (this.onCameraHandlers !== null)
         {
            for (var h in this.onCameraHandlers)
            {
               this.onCameraHandlers[h].call(this, camera, perspective);
            }
         }

         // process each object in the scene graph
         // and recursively process each child entity (against parent local matrix)
         var renderlist = [],
             lights = [];
         
         // recursive processing function - keeps track of current matrix operation
         var fnProcessEntities = function processEntities(entities, matParent)
         {
            for (var n=0, obj, len, isIdentity; n<entities.length; n++)
            {
               obj = entities[n];
               
               // multiply local with parent matrix to combine affine transformation
               var matLocal = obj.matrix;
               if (matParent)
               {
                  matLocal = mat4.multiply(mat4.clone(matLocal), matLocal, matParent);
               }
               isIdentity = Phoria.Util.isIdentity(matLocal);
               
               // hook point for onScene event handlers - custom user handlers or added by entities during
               // object construction - there can be multiple registered per entity
               if (obj.onSceneHandlers !== null)
               {
                  for (var h in obj.onSceneHandlers)
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
                  
                  for (var v=0, verts, vec; v<len; v++)
                  {
                     // construct homogeneous coordinate for the vertex as a vec4
                     verts = obj.points[v];
                     vec = vec4.set(obj._worldcoords[v], verts.x, verts.y, verts.z, 1);
                     
                     // local object transformation -> world
                     // skip local transform if matrix === identity
                     // else store locally transformed vec4 world points
                     if (!isIdentity) vec4.transformMat4(vec, vec, matLocal);
                  }
                  
                  // multiply by camera matrix to generate world coords
                  for (var v=0; v<len; v++)
                  {
                     vec4.transformMat4(obj._coords[v], obj._worldcoords[v], camera);
                  }
                  
                  // sort the object before any further transformations
                  if (obj.style.shademode === "lightsource")
                  {
                     switch (obj.style.drawmode)
                     {
                        case "solid":
                           Phoria.Util.sortPolygons(obj.polygons, obj._coords);
                           break;
                        case "wireframe":
                           Phoria.Util.sortEdges(obj.edges, obj._coords);
                           break;
                        case "point":
                           Phoria.Util.sortPoints(obj._coords, obj._worldcoords);
                           break;
                     }
                  }
                  
                  // multiply by perspective matrix to generate clip coordinates
                  for (var v=0; v<len; v++)
                  {
                     // store perspective transformed vec4
                     vec4.transformMat4(obj._coords[v], obj._coords[v], perspective);
                  }
                  
                  // perspective division to create vec2 NDC then finally transform to viewport
                  // clip calculation occurs before the viewport transform
                  var objClip = 0;
                  for (var v=0, vec, w; v<len; v++)
                  {
                     vec = obj._coords[v];
                     w = vec[3];
                     
                     // stop divide by zero
                     if (w === 0) w = EPSILON;
                     
                     // is this vertex outside the clipping boundries for the perspective frustum?
                     objClip += (obj._clip[v] = (vec[0] > w || vec[0] < -w || vec[1] > w || vec[1] < -w || vec[2] > w || vec[2] < -w) ? 1 : 0);
                     
                     // perspective division
                     vec[0] /= w;
                     vec[1] /= w;
                     vec[2] /= w;   // Z is used by coarse object depth sort
                     
                     // linear transform to viewport - could combine with division above - but for clarity it is not
                     vec[0] = vpw * vec[0] + vpx + vpw;
                     vec[1] = vph * vec[1] + vpy + vph;
                  }
                  
                  // if entire object is clipped, do not bother with final steps or adding to render list
                  if (objClip !== len)
                  {
                     // normal lighting transformation
                     if (obj.polygons.length !== 0)
                     {
                        var matNormals = matLocal;
                        // NOTE: have a flag on scene for "transposedNormalMatrix..."?
                        // invert and transpose the view matrix - for correct normal scaling?
                        //mat4.invert(mat4.clone(matLocal), matLocal);
                        //mat4.transpose(matNormals, matNormals);
                        
                        switch (obj.style.shademode)
                        {
                           case "plain":
                           case "lightsource":
                           {
                              // transform each polygon normal
                              for (var i=0, normal, wnormal; i<obj.polygons.length; i++)
                              {
                                 if (!obj.polygons[i]._worldnormal) obj.polygons[i]._worldnormal = vec4.create();
                                 
                                 // normal transformation -> world
                                 normal = obj.polygons[i].normal;
                                 wnormal = obj.polygons[i]._worldnormal;
                                 vec4.transformMat4(wnormal, normal, matNormals);
                                 vec4.normalize(wnormal, wnormal);
                              }
                              break;
                           }
                           /*case "gouraud":
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
                           }*/
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
         fnProcessEntities.call(this, this.graph);

         this.renderlist = renderlist;
         this.lights = lights;
      }
   };
})();
