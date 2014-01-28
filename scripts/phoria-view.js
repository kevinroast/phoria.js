/**
 * @fileoverview phoria - View Control. Helpers to control the view via mouse, provide high-level mouse events.
 * Reverse object selection (entity picking) - contribution from Ruan Moolman.
 * @author Kevin Roast
 * @date 26th Jan 2014
 */

/**
 * View helper class. Provides view related utilities such as high-level event handling. Reverse object selection (entity picking).
 * 
 * @class Phoria.View
 */
(function() {
   "use strict";
   
   Phoria.View = {};
   
   Phoria.View.events = {};
   
   Phoria.View.addMouseEvents = function addMouseEvents(el, fnOnClick)
   {
      if (el.id)
      {
         // mouse rotation and position tracking instance
         var mouse = {
            velocityH: 0,        // final target value from horizontal mouse movement 
            velocityLastH: 0,
            positionX: 0,
            clickPositionX: 0,   // last mouse click position
            velocityV: 0,        // final target value from vertical mouse movement 
            velocityLastV: 0,
            positionY: 0,
            clickPositionY: 0    // last mouse click position
         };
         
         // set object reference for our events
         Phoria.View.events[el.id] = mouse;
         
         mouse.onMouseMove = function onMouseMove(evt) {
         	mouse.positionX = evt.clientX;
         	mouse.velocityH = mouse.velocityLastH + (mouse.positionX - mouse.clickPositionX) * 0.5;
         	mouse.positionY = evt.clientY;
         	mouse.velocityV = mouse.velocityLastV + (mouse.positionY - mouse.clickPositionY) * 0.5;
         };
         
         mouse.onMouseUp = function onMouseUp(evt) {
         	el.removeEventListener('mousemove', mouse.onMouseMove, false);
         };
         
         mouse.onMouseOut = function onMouseOut(evt) {
         	el.removeEventListener('mousemove', mouse.onMouseMove, false);
         };
         
         mouse.onMouseDown = function onMouseDown(evt) {
         	evt.preventDefault();
         	el.addEventListener('mousemove', mouse.onMouseMove, false);
         	mouse.clickPositionX = evt.clientX;
         	mouse.velocityLastH = mouse.velocityH;
         	mouse.clickPositionY = evt.clientY;
         	mouse.velocityLastV = mouse.velocityV;
         };
         
         el.addEventListener('mousedown', mouse.onMouseDown, false);
         el.addEventListener('mouseup', mouse.onMouseUp, false);
         el.addEventListener('mouseout', mouse.onMouseOut, false);
         
         // add click handler if supplied
         if (fnOnClick) el.addEventListener('click', fnOnClick, false);
         
         return mouse;
      }
   }
   
   Phoria.View.removeMouseEvents = function removeMouseEvents(el, fnOnClick)
   {
      if (el.id)
      {
         var mouse = Phoria.View.events[el.id];
         if (mouse)
         {
            el.removeEventListener('mousemove', mouse.onMouseMove, false);
            el.removeEventListener('mousedown', mouse.onMouseDown, false);
            el.removeEventListener('mouseup', mouse.onMouseUp, false);
            el.removeEventListener('mouseout', mouse.onMouseOut, false);
            if (fnOnClick) el.removeEventListener('click', fnOnClick, false);
            Phoria.View.events[el.id] = null;
         }
      }
   }
   
   Phoria.View.getMouse = function getMouse(el)
   {
      return Phoria.View.events[el.id];
   }
   
   Phoria.View.calculateClickPointAndVector = function calculateClickPointAndVector(scene, mousex, mousey)
   {
      var camLookAt = vec3.fromValues(
         scene.camera.lookat.x,
         scene.camera.lookat.y,
         scene.camera.lookat.z);
      var camOff = vec3.subtract(vec3.create(), scene._cameraPosition, camLookAt);
      
      // get pixels per unit at click plane (plane normal to camera direction going through the camera focus point)
      var pixelsPerUnit = (scene.viewport.height / 2) / (vec3.length(camOff) * Math.tan((scene.perspective.fov / 180 * Math.PI) / 2));
      
      // calculate world units (from the centre of canvas) corresponding to the mouse click position
      var dif = vec2.fromValues(mousex - (scene.viewport.width / 2), mousey - (scene.viewport.height / 2));
      vec2.subtract(dif, dif, new vec2.fromValues(8, 8)); // calibrate
      var units = vec2.create();
      vec2.scale(units, dif, 1 / pixelsPerUnit);
      
      // move click point horizontally on click plane by the number of units calculated from the x offset of the mouse click
      var upVector = vec3.fromValues(scene.camera.up.x, scene.camera.up.y, scene.camera.up.z);
      var normalVectorSide = vec3.create();
      vec3.cross(normalVectorSide, camOff, upVector);
      vec3.normalize(normalVectorSide, normalVectorSide);
      var clickPoint = vec3.scaleAndAdd(vec3.create(), camLookAt, normalVectorSide, units[0]);
      
      // move click point vertically on click plane by the number of units calculated from the y offset of the mouse click
      var normalVectorUp = vec3.create();
      vec3.cross(normalVectorUp, normalVectorSide, camOff);
      vec3.normalize(normalVectorUp, normalVectorUp);
      vec3.scale(normalVectorUp, normalVectorUp, units[1]);
      vec3.subtract(clickPoint, clickPoint, normalVectorUp);
      
      // calculate click vector (vector from click point to the camera's position)
      var camVector = vec3.add(vec3.create(), camLookAt, camOff);
      return {
         clickPoint: clickPoint,
         clickVector: vec3.subtract(vec3.create(), clickPoint, camVector)
      };
   }
   
   Phoria.View.getIntersectedObjects = function getIntersectedObjects(scene, clickPoint, clickVector)
   {
      var intersections = [], obj, polygonNormal, polygonPoint, polygonCoords, polygonPlaneIntersection, pointVector;
      
      // Go through all the appropriate objects
      var objects = scene.renderlist;
      for (var n = 0, obj; n < objects.length; n++)
      {
         obj = objects[n];
         
         // only consider solid objects
         if (obj.style.drawmode !== "solid") continue;
         
         // Go through all the polygons of an object
         for (var m = 0; m < obj.polygons.length; m++)
         {
            polygonNormal = vec3.clone(obj.polygons[m]._worldnormal);
            polygonPoint = vec3.clone(obj._worldcoords[obj.polygons[m].vertices[0]]);
            
            // Get the point where the line intersectects the polygon's plane
            polygonPlaneIntersection = Phoria.Util.planeLineIntersection(polygonNormal, polygonPoint, clickVector, clickPoint);
            
            // if the intersection is null, it means the line does not intersect the plane
            if (polygonPlaneIntersection !== null)
            {
               // Check if the intersection is inside the polygon
               if (Phoria.Util.intersectionInsidePolygon(obj.polygons[m], obj._worldcoords, polygonPlaneIntersection))
               {
                  // add intersection to the array being returned
                  var returnObject = {
                     entity: obj,
                     polygonIndex: m,
                     intersectionPoint: polygonPlaneIntersection
                  };
                  intersections.push(returnObject);
               }
            }
         }
      }
      
      // calculate distance to each intersection from camera's position
      for (var i = 0; i < intersections.length; i++)
      {
         intersections[i].distance = vec3.distance(scene._cameraPosition, intersections[i].intersectionPoint);
      }
      
      // sort intersection points from closest to farthest
      for (var i = 0; i < intersections.length - 1; i++)
      {
         for (var j = i + 1, keepVal; j < intersections.length; j++)
         {
            if (intersections[i].distance >= intersections[j].distance)
            {
               keepVal = intersections[j];
               intersections[j] = intersections[i];
               intersections[i] = keepVal;
            }
         }
      }
      
      // return list of all intersections
      return intersections;
   }

})();
