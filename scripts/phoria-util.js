/**
 * @fileoverview phoria - Utilities and helpers, including root namespace.
 * @author Kevin Roast
 * @date 10th April 2013
 */

// Global constants
var RADIANS = Math.PI/180.0;
var PI = Math.PI;
var TWOPI = Math.PI*2;
var ONEOPI = 1.0 / Math.PI;
var PIO2 = Math.PI/2;
var EPSILON = 0.000001;

// glMatrix library - many small Arrays are faster without the use of Float32Array wrap/conversion
glMatrix.setMatrixArrayType(Array);

/**
 * Creates a new vec3 initialized with the given xyz tuple
 *
 * @param {x:0,y:0,z:0} xyz object property tuple
 * @returns {vec3} a new 3D vector
 */
vec3.fromXYZ = function(xyz) {
   var out = new Array(3);
   out[0] = xyz.x;
   out[1] = xyz.y;
   out[2] = xyz.z;
   return out;
};

/**
 * Creates a new vec4 initialized with the given xyz tuple and w coordinate
 *
 * @param {x:0,y:0,z:0} xyz object property tuple
 * @param w {Number} w coordinate
 * @returns {vec4} a new 4D vector
 */
vec4.fromXYZ = function(xyz, w) {
   var out = new Array(4);
   out[0] = xyz.x;
   out[1] = xyz.y;
   out[2] = xyz.z;
   out[3] = w;
   return out;
};


/**
 * Phoria root namespace.
 *
 * @namespace Phoria
 */
if (typeof Phoria === "undefined" || !Phoria)
{
   var Phoria = {};
}


(function() {
   "use strict";

   Phoria.Util = {};
   
   /**
    * Utility to set up the prototype, constructor and superclass properties to
    * support an inheritance strategy that can chain constructors and methods.
    * Static members will not be inherited.
    * 
    * @param {Function} subc   the object to modify
    * @param {Function} superc the object to inherit
    * @param {Object} overrides  additional properties/methods to add to the
    *                            subclass prototype.  These will override the
    *                            matching items obtained from the superclass.
    */
   Phoria.Util.extend = function extend(subc, superc, overrides)
   {
      var F = function() {}, i;
      F.prototype = superc.prototype;
      subc.prototype = new F();
      subc.prototype.constructor = subc;
      subc.superclass = superc.prototype;
      if (superc.prototype.constructor == Object.prototype.constructor)
      {
         superc.prototype.constructor = superc;
      }
      
      if (overrides)
      {
         for (i in overrides)
         {
            if (overrides.hasOwnProperty(i))
            {
               subc.prototype[i] = overrides[i];
            }
         }
      }
   }
   
   Phoria.Util.augment = function augment(r, s)
   {
      for (var p in s.prototype)
      {
         if (typeof r.prototype[p] === "undefined")
         {
            r.prototype[p] = s.prototype[p];
         }
      }
   }
   
   /**
    * Merge two objects - useful for config default and user settings merging.
    * Deep merge returning the combined object. The source overwrites the target if names match.
    * Arrays are merged, but source values for base datatypes always win.
    */
   Phoria.Util.merge = function merge(target, src)
   {
      var array = Array.isArray(src),
          dst = array && [] || {};
      
      if (array)
      {
         target = target || [];
         dst = dst.concat(target);
         src.forEach(function(e, i)
         {
            if (typeof e === 'object')
            {
               dst[i] = Phoria.Util.merge(target[i], e);
            }
            else
            {
               // overwrite basic value types - source wins
               dst[i] = e;
            }
         });
      }
      else
      {
         if (target && typeof target === 'object')
         {
            Object.keys(target).forEach(function (key) {
               dst[key] = target[key];
            });
         }
         Object.keys(src).forEach(function (key) {
            if (typeof src[key] !== 'object' || !src[key])
            {
               dst[key] = src[key];
            }
            else
            {
               if (!target[key])
               {
                  dst[key] = src[key];
               }
               else
               {
                  dst[key] = Phoria.Util.merge(target[key], src[key]);
               }
            }
         });
      }
      
      return dst;
   }
   
   /**
    * Shallow and cheap (1 level deep only) clone for simple property based objects.
    * Properties are only safely copied if they are base datatypes or array of such.
    */
   Phoria.Util.clone = function clone(src)
   {
      var n = null,
          dst = {};
      for (var p in src)
      {
         n = src[p];
         if (Array.isArray(n))
         {
            dst[p] = [].concat(n);
         }
         else
         {
            dst[p] = n;
         }
      }
      return dst;
   }
   
   /**
    * Return true if the given mat4 is an identity (noop) matrix, false otherwise
    */
   Phoria.Util.isIdentity = function isIdentity(mat)
   {
      return (
         mat[0] === 1 && 
         mat[1] === 0 &&
         mat[2] === 0 &&
         mat[3] === 0 &&
         mat[4] === 0 &&
         mat[5] === 1 &&
         mat[6] === 0 &&
         mat[7] === 0 &&
         mat[8] === 0 &&
         mat[9] === 0 &&
         mat[10] === 1 &&
         mat[11] === 0 &&
         mat[12] === 0 &&
         mat[13] === 0 &&
         mat[14] === 0 &&
         mat[15] === 1);
   }

   /**
    * Calculate a vec4 normal vector from given tri coordinates
    */
   Phoria.Util.calcNormalVector = function calcNormalVector(x1, y1, z1, x2, y2, z2)
   {
      var v = vec4.fromValues(
         (y1 * z2) - (z1 * y2),
         -((z2 * x1) - (x2 * z1)),
         (x1 * y2) - (y1 * x2), 0 );
      return vec4.normalize(v, v);
   }
   
   /**
    * Calculate the angle between two 3D vectors
    */
   Phoria.Util.thetaTo = function thetaTo(v1, v2)
   {
      return Math.acos(vec3.dot(v1, v2) / (Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]) * Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2])));
   }
   
   /**
    * Return a vec3 representing the average world coordinate for the given polygon vertices
    */
   Phoria.Util.averagePolyVertex = function averagePolyVertex(vertices, worldcoords)
   {
      for (var i=0,avx=0,avy=0,avz=0; i<vertices.length; i++)
      {
         avx += worldcoords[ vertices[i] ][0];
         avy += worldcoords[ vertices[i] ][1];
         avz += worldcoords[ vertices[i] ][2];
      }
      return vec3.fromValues(
         avx / vertices.length,
         avy / vertices.length,
         avz / vertices.length);
   }
   
   /**
    * Return the average Z coordinate for a list of coordinates
    */
   Phoria.Util.averageObjectZ = function averageObjectZ(coords)
   {
      var av = 0;
      for (var i=0; i<coords.length; i++)
      {
         av += coords[i][3];
      }
      return av / coords.length;
   }

   /**
    * Sort a list of polygons by the Z coordinates in the supplied coordinate list
    */
   Phoria.Util.sortPolygons = function sortPolygons(polygons, worldcoords)
   {
      for (var i=0,verts; i<polygons.length; i++)
      {
         verts = polygons[i].vertices;
         /*for (var n=0; n<verts.length; n++)
         {
            avz += worldcoords[ verts[n] ][2];
         }*/
         polygons[i]._avz = (worldcoords[ verts[0] ][2] + worldcoords[ verts[1] ][2] + worldcoords[ verts[2] ][2]) * 0.333333;
      }
      polygons.sort(function sortPolygonsZ(f1, f2) {
         return (f1._avz < f2._avz ? -1 : 1);
      });
   }

   Phoria.Util.sortEdges = function sortEdges(edges, coords)
   {
      for (var i=0; i<edges.length; i++)
      {
         edges[i]._avz = (coords[ edges[i].a ][2] + coords[ edges[i].b ][2]) * 0.5;
      }
      edges.sort(function sortEdgesZ(f1, f2) {
         return (f1._avz < f2._avz ? -1 : 1);
      });
   }

   Phoria.Util.sortPoints = function sortPoints(coords, worldcoords)
   {
      // we need our own sort as we need to swap items in two lists during the sorting process
      var quickSort = function quickSort(c, a, left, right)
      {
         var leftIndex = left, rightIndex = right, partionElement, tempP;
         
         if (right > left)
         {
            // get midpoint of the array
            partionElement = a[(left + right) >> 1][2];
            
            // loop through the array until indices cross
            while (leftIndex <= rightIndex)
            {
               // find the first element that is < the partionElement starting
               // from the leftIndex (Z coord of point)
               while (leftIndex < right && a[leftIndex][2] < partionElement)
                  leftIndex++;
               
               // find an element that is greater than the
               // partionElement starting from the rightIndex
               while (rightIndex > left && a[rightIndex][2] > partionElement)
                  rightIndex--;
               
               // if the indexes have not crossed, swap
               if (leftIndex <= rightIndex)
               {
                  // swap world and screen objects
                  tempP = c[leftIndex];
                  c[leftIndex] = c[rightIndex];
                  c[rightIndex] = tempP;
                  tempP = a[leftIndex];
                  a[leftIndex] = a[rightIndex];
                  a[rightIndex] = tempP;
                  leftIndex++;
                  rightIndex--;
               }
            }
            
            // if the right index has not reached the left side of the array then
            // must sort the left partition.
            if (left < rightIndex)
            {
               quickSort(c, a, left, rightIndex);
            }
            
            // if the left index has not reached the left side of the array then 
            // must sort the left partition. 
            if (leftIndex < right)
            {
               quickSort(c, a, leftIndex, right);
            }
         }
      }
      quickSort(worldcoords, coords, 0, coords.length - 1);
   }
   
   /**
    * Generates an object of a subdivided plane 0-1 in the x-z plane
    * 
    * @param vsegs   Number of vertical segments
    * @param hsegs   Number of horizontal segments
    * @param level   TODO: Subdivision level, 0-2 (quads, 2 tris, 4 tris)
    * @param scale   Scale of the plane - 1.0 is a unit plane centred on the origin
    */
   Phoria.Util.generateTesselatedPlane = function generateTesselatedPlane(vsegs, hsegs, level, scale)
   {
      var points = [], edges = [], polys = [], hinc = scale/hsegs, vinc = scale/vsegs, c = 0;
      for (var i=0, x, y = -scale/2; i<=vsegs; i++)
      {
         x = -scale/2;
         for (var j=0; j<=hsegs; j++)
         {
            // generate a row of points
            points.push( {x: x, y: 0, z: y} );
            
            // edges
            if (j !== 0)
            {
               edges.push( {a:c, b:c-1} );
            }
            if (i !== 0)
            {
               edges.push( {a:c, b:c-hsegs-1} );
            }

            if (i !== 0 && j !== 0)
            {
               // generate quad
               polys.push( {vertices:[c-hsegs-1, c-hsegs-2, c-1, c]} );
            }
            
            x += hinc;
            c++;
         }
         y += vinc;
      }
      
      return {
         points: points,
         edges: edges,
         polygons: polys
      };
   }

   /**
    * Generate the geometry for a 1x1x1 unit cube
    */
   Phoria.Util.generateUnitCube = function generateUnitCube(scale)
   {
      var s = scale || 1;
      return {
         points: [{x:-1*s,y:1*s,z:-1*s}, {x:1*s,y:1*s,z:-1*s}, {x:1*s,y:-1*s,z:-1*s}, {x:-1*s,y:-1*s,z:-1*s},
                  {x:-1*s,y:1*s,z:1*s}, {x:1*s,y:1*s,z:1*s}, {x:1*s,y:-1*s,z:1*s}, {x:-1*s,y:-1*s,z:1*s}],
         edges: [{a:0,b:1}, {a:1,b:2}, {a:2,b:3}, {a:3,b:0}, {a:4,b:5}, {a:5,b:6}, {a:6,b:7}, {a:7,b:4}, {a:0,b:4}, {a:1,b:5}, {a:2,b:6}, {a:3,b:7}],
         polygons: [{vertices:[0,1,2,3]},{vertices:[0,4,5,1]},{vertices:[1,5,6,2]},{vertices:[2,6,7,3]},{vertices:[4,0,3,7]},{vertices:[5,4,7,6]}]
      };
   }

   /**
    * Generate the geometry for a sphere - triangles form the top and bottom segments, quads form the strips.
    */
   Phoria.Util.generateSphere = function generateSphere(scale, lats, longs)
   {
      var points = [], edges = [], polys = [];

      for (var latNumber = 0; latNumber <= lats; ++latNumber)
      {
         for (var longNumber = 0; longNumber <= longs; ++longNumber)
         {
            var theta = latNumber * Math.PI / lats;
            var phi = longNumber * 2 * Math.PI / longs;
            var sinTheta = Math.sin(theta);
            var sinPhi = Math.sin(phi);
            var cosTheta = Math.cos(theta);
            var cosPhi = Math.cos(phi);

            var x = cosPhi * sinTheta;
            var y = cosTheta;
            var z = sinPhi * sinTheta;
            //var u = 1-(longNumber/longs);
            //var v = latNumber/lats;

            //texCoordData.push(u);
            //texCoordData.push(v);
            points.push({
               x: scale * x,
               y: scale * y,
               z: scale * z});
         }
      }

      for (var latNumber = 0; latNumber < lats; ++latNumber)
      {
         for (var longNumber = 0; longNumber < longs; ++longNumber)
         {
            var first = (latNumber * (longs+1)) + longNumber;
            var second = first + longs + 1;
            
            if (latNumber === 0)
            {
               // top triangle
               polys.push({vertices: [first+1, second+1, second]});
               edges.push( {a:first, b:second} );
            }
            else if (latNumber === lats-1)
            {
               // bottom triangle
               polys.push({vertices: [first+1, second, first]});
               edges.push( {a:first, b:second} );
            }
            else
            {
               // quad strip
               polys.push({vertices: [first+1, second+1, second, first]});
               edges.push( {a:first, b:second} );
               edges.push( {a:second, b:second+1} );
            }
         }
      }

      return {
         points: points,
         edges: edges,
         polygons: polys
      };
   }

})();


/**
 * Image Preloader class. Executes the supplied callback function once all
 * registered images are loaded by the browser.
 * 
 * @class Phoria.Preloader
 */
(function() {
   "use strict";

   Phoria.Preloader = function()
   {
      this.images = [];
      return this;
   };
   
   Phoria.Preloader.prototype =
   {
      /**
       * Image list
       *
       * @property images
       * @type Array
       */
      images: null,
      
      /**
       * Callback function
       *
       * @property callback
       * @type Function
       */
      callback: null,
      
      /**
       * Images loaded so far counter
       */
      counter: 0,
      
      /**
       * Add an image to the list of images to wait for
       */
      addImage: function addImage(img, url)
      {
         var me = this;
         img.url = url;
         // attach closure to the image onload handler
         img.onload = function()
         {
            me.counter++;
            if (me.counter === me.images.length)
            {
               // all images are loaded - execute callback function
               me.callback.call(me);
            }
         };
         this.images.push(img);
      },
      
      /**
       * Load the images and call the supplied function when ready
       */
      onLoadCallback: function onLoadCallback(fn)
      {
         this.counter = 0;
         this.callback = fn;
         // load the images
         for (var i=0, j=this.images.length; i<j; i++)
         {
            this.images[i].src = this.images[i].url;
         }
      }
   };
})();
