/**
 * @fileoverview phoria - Scene renderers. Canvas renderer and prototype Software renderer.
 * @author Kevin Roast
 * @date 15th March 2014
 */

define(['phoria-namespace', 'phoria-util', 'phoria-gl-matrix'], function(Phoria, Util, PhoriaGlMatrix) {

  Phoria.Util = Util;

  var vec2    = PhoriaGlMatrix.vec2,
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
      * Base Renderer that defines helper functions used by specific rendering classes.
      */
     Phoria.Renderer = function()
     {
     };
     
     Phoria.Renderer.prototype = {
        // {boolean} true to sort the objects in the scene by average Z coordinate, false to render the list without sorting
        sort: true,
        
        /**
         * Sort the list of objects in the scene by average Z coordinate. Prepares the flattened render
         * list to be rendered object by object using the painters algorithm.
         * 
         * @param scene {Phoria.Scene}
         */
        sortObjects: function sortObjects(scene)
        {
           // calculate and sort objects in average Z order
           if (this.sort)
           {
              for (var n=0,obj; n<scene.renderlist.length; n++)
              {
                 // ensure we have an average z coord for the objects to test
                 obj = scene.renderlist[n];
                 switch (obj.style.objectsortmode)
                 {
                    case "sorted":
                       // average z coord is calculated during scene processing
                       break;
                    case "front":
                       // to the front - remember the Z direction is reversed
                       obj._averagez = Number.MIN_VALUE;
                       break;
                    case "back":
                    default:
                       // to the back - remember the Z direction is reversed
                       obj._averagez = Number.MAX_VALUE;
                       break;
                 }
              }
              scene.renderlist.sort(function sortObjectsZ(a, b) {
                 return (a._averagez < b._averagez ? 1 : -1);
              });
           }
        },

        /**
         * Calculate brightness for the normal based on a set of lights
         * 
         * @param position {vec3}        Position of the source polygon e.g. vertex or average poly point
         * @param normal {vec3}          Normal to calculate brightness against
         * @param scene {Phoria.Scene}   Scene - lights and current camera position are queried from here
         * @param obj {Phoria.Entity}    Object - style is used for diffuse/specular calculations
         * @return RGB float component array for final brightness - values added to current values
         */
        calcNormalBrightness: function calcNormalBrightness(position, normal, scene, obj)
        {
           var rgb = [0.0,0.0,0.0],
               lights = scene.lights;
           for (var e=0, light, brightness; e<lights.length; e++)
           {
              light = lights[e];
              
              if (light instanceof Phoria.DistantLight)
              {
                 // Distant lights have no "position", just a direction - they light the world with parallel rays
                 // from an infinitely distant location - closest example is light from the sun when overhead
                 // note that light worlddirection is precalculated as negative.
                 var dotVP = vec3.dot(normal, light.worlddirection);
                 
                 // don't waste any more time calculating if the dot product is negative i.e. > 90 degrees
                 if (dotVP <= 0) continue;
                 
                 // combine light intensity with dot product and object diffuse value
                 brightness = dotVP * light.intensity * obj.style.diffuse;
              }
              else if (light instanceof Phoria.PointLight)
              {
                 // Point lights have a position and a fall-off known as attenuation
                 // distance falloff calculation - each light is additive to the total
                 var vecToLight = vec3.subtract(vec3.create(), position, light.worldposition),
                     distance = vec3.length(vecToLight),
                     attenuation;
                 vec3.normalize(vecToLight, vecToLight);
                 var dotVP = vec3.dot(normal, vec3.negate(vecToLight, vecToLight));
                 
                 // don't waste any more time calculating if the dot product is negative i.e. > 90 degrees
                 if (dotVP <= 0) continue;
                 
                 switch (light.attenuationFactor)
                 {
                    default:
                    case "none":
                       attenuation = light.attenuation;
                       break;
                    case "linear":
                       attenuation = light.attenuation * distance;
                       break;
                    case "squared":
                       attenuation = light.attenuation * distance * distance;
                       break;
                 }
                 
                 // Optional specular highlight calculation
                 if (obj.style.specular !== 0)
                 {
                    var halfV = vec3.add(vec3.create(), vecToLight, scene._cameraPosition),
                        dotHV = vec3.dot(normal, vec3.normalize(halfV, halfV)),
                        pf = Math.pow(dotHV, obj.style.specular) * light.intensity / attenuation;
                    rgb[0] += pf * light.color[0];
                    rgb[1] += pf * light.color[1];
                    rgb[2] += pf * light.color[2];
                 }
                 
                 brightness = obj.style.diffuse * dotVP * light.intensity / attenuation;
              }
              
              // apply each colour component based on light levels (0.0 to 1.0)
              rgb[0] += brightness * light.color[0];
              rgb[1] += brightness * light.color[1];
              rgb[2] += brightness * light.color[2];
           }
           return rgb;
        },

        /**
         * Calculate brightness for the position based on a set of lights. It is assumed the entity at the position
         * has no normal vector i.e. it is a point in space only.
         * 
         * @param position {vec3}  Position of the source polygon e.g. vertex or average poly point
         * @param lights {Array}   Array of light entities to process
         * @return RGB float component array for final brightness - values added to current values
         */
        calcPositionBrightness: function calcPositionBrightness(position, lights)
        {
           var rgb = [0.0,0.0,0.0];
           for (var e=0, light, brightness; e<lights.length; e++)
           {
              light = lights[e];
              
              if (light instanceof Phoria.DistantLight)
              {
                 // Distant lights have no "position"
                 brightness = light.intensity;
              }
              else if (light instanceof Phoria.PointLight)
              {
                 // Point lights have a position and a fall-off known as attenuation
                 var vecToLight = vec3.subtract(vec3.create(), position, light.worldposition),
                     distance = vec3.length(vecToLight),
                     attenuation;
                 vec3.normalize(vecToLight, vecToLight);
                 
                 switch (light.attenuationFactor)
                 {
                    case "linear":
                       attenuation = light.attenuation * distance;
                       break;
                    case "squared":
                       attenuation = light.attenuation * distance * distance;
                       break;
                    default:
                    case "none":
                       attenuation = light.attenuation;
                       break;
                 }
                 
                 // NOTE: increasing attenuation to try to light wires similar brightness to polygons that
                 //       are lit by the same light - other options would be to properly calculate the lighting
                 //       normal based on the polygons that share the edges - this would mean more complicated
                 //       object descriptions - but provide much more accurate wireframe/point lighting...
                 brightness = light.intensity / (attenuation * 2);
              }
              
              // apply each colour component based on light levels (0.0 to 1.0)
              rgb[0] += brightness * light.color[0];
              rgb[1] += brightness * light.color[1];
              rgb[2] += brightness * light.color[2];
           }
           return rgb;
        },

        /**
         * Inflate the vertices of a polygon - see inflatePolygonFull() below for a richer impl - this
         * algorithm is not quite as neat and suffers when the camera lines up exactly with perpendicular
         * edges - however it is much, much faster.
         */
        inflatePolygon: function inflatePolygon(vertices, coords, pixels)
        {
           pixels = pixels || 0.5;
           var inflatedVertices = new Array(vertices.length);
           for (var i=0; i<vertices.length; i++)
           {
              inflatedVertices[i] = [ coords[vertices[i]][0], coords[vertices[i]][1] ];
           }
           for (var i=0, j=vertices.length,k,x1,y1,x2,y2,dx,dy,len; i<j; i++)
           {
              k = (i < j - 1) ? (i+1) : 0;
              x1 = inflatedVertices[i][0];
              y1 = inflatedVertices[i][1];
              x2 = inflatedVertices[k][0];
              y2 = inflatedVertices[k][1];
              var x = x2 - x1, y = y2 - y1,
                  det = x * x + y * y, idet;

              if (det === 0) det === Phoria.EPSILON;

              idet = pixels / Math.sqrt(det);

              x *= idet; y *= idet;

              inflatedVertices[i][0] -= x;
              inflatedVertices[i][1] -= y;
              inflatedVertices[k][0] += x;
              inflatedVertices[k][1] += y;
           }
           return inflatedVertices;
        },

        /**
         * Inflate polygon by 0.5 screen pixels to cover cracks generates by the canvas 2D shape fill convention.
         *  see http://stackoverflow.com/questions/3749678/expand-fill-of-convex-polygon
         *  and http://stackoverflow.com/questions/1109536/an-algorithm-for-inflating-deflating-offsetting-buffering-polygons
         * This neat routine means that the gaps between polygons seen in other Canvas based renders are not present. It adds
         * a few percent overhead in CPU processing, but that is much less than the canvas overhead of multiple fill() or other
         * techniques commonly used to hide the polygon cracks. Also the multiple fill or fill then stroke techniques will not
         * work with textured polygons.
         */
        inflatePolygonFull: function inflatePolygonFull(vertices, coords, pixels)
        {
           pixels = pixels || 0.5;
           // generate vertices of parallel edges
           var pedges = [], inflatedVertices = new Array(vertices.length);
           for (var i=0, j=vertices.length, x1,y1,x2,y2,dx,dy,len; i<j; i++)
           {
              // collect an edge
              x1 = coords[vertices[i]][0];
              y1 = coords[vertices[i]][1];
              if (i < j - 1)
              {
                 x2 = coords[vertices[i+1]][0];
                 y2 = coords[vertices[i+1]][1];
              }
              else
              {
                 x2 = coords[vertices[0]][0];
                 y2 = coords[vertices[0]][1];
              }
              
              // compute outward facing normal vector - and normalise the length
              dx = y2 - y1;
              dy = -(x2 - x1);
              len = Math.sqrt(dx * dx + dy * dy);
              dx /= len;
              dy /= len;
              
              // multiply by the distance to the parallel edge
              dx *= pixels;
              dy *= pixels;
              
              // generate and store parallel edge
              pedges.push({x: x1 + dx, y: y1 + dy});
              pedges.push({x: x2 + dx, y: y2 + dy});
           }
           
           // calculate intersections to build new screen coords for inflated poly
           for (var i=0, j=vertices.length, vec; i<j; i++)
           {
              if (i === 0)
              {
                 vec = this.intersection(pedges[(j-1) * 2], pedges[(j-1) * 2 + 1], pedges[0], pedges[1]);
              }
              else
              {
                 vec = this.intersection(pedges[(i-1) * 2], pedges[(i-1) * 2 + 1], pedges[i * 2], pedges[i * 2 + 1]);
              }
              // handle edge case (haha) where inflated polygon vertex edges jump towards infinity
              if (Math.abs(vec[0] - coords[vertices[i]][0]) > 1.5 || Math.abs(vec[1] - coords[vertices[i]][1]) > 1.5)
              {
                 // reset to original coordinates
                 vec[0] = coords[vertices[i]][0];
                 vec[1] = coords[vertices[i]][1];
              }
              inflatedVertices[i] = vec;
           }
           
           return inflatedVertices;
        },
        
        intersection: function intersection(line0v0, line0v1, line1v0, line1v1)
        {
           var a1 = line0v1.x - line0v0.x,
               b1 = line1v0.x - line1v1.x,
               c1 = line1v0.x - line0v0.x,
               a2 = line0v1.y - line0v0.y,
               b2 = line1v0.y - line1v1.y,
               c2 = line1v0.y - line0v0.y,
               t = (b1*c2 - b2*c1) / (a2*b1 - a1*b2);
           
           return [
              line0v0.x + t * (line0v1.x - line0v0.x),
              line0v0.y + t * (line0v1.y - line0v0.y)
           ];
        }
     };
  })();

  return Phoria.Renderer;

});