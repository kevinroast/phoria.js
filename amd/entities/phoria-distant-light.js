define(['phoria-namespace', 'phoria-util', 'entities/phoria-base-entity', 'entities/phoria-base-light', 'phoria-gl-matrix'], 
  function(Phoria, Util, BaseEntity, BaseLight, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.BaseEntity = BaseEntity;
  Phoria.BaseLight = BaseLight;

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

  return Phoria.DistantLight;
});