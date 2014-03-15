define(['phoria-namespace', 'phoria-util', 'entities/phoria-base-entity', 'entities/phoria-base-light', 
  'entities/phoria-positional-aspect', 'phoria-gl-matrix'], 
  function(Phoria, Util, BaseEntity, BaseLight, PositionalAspect, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.BaseEntity = BaseEntity;
  Phoria.BaseLight = BaseLight;
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

  return Phoria.PointLight;
});