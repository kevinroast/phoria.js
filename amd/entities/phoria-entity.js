define(['phoria-namespace', 'phoria-util', 'entities/phoria-base-entity', 'phoria-gl-matrix'], 
  function(Phoria, Util, BaseEntity, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.BaseEntity = BaseEntity;

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

  return Phoria.Entity;
});
