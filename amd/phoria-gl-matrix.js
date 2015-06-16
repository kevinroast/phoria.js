/**
 * Augment glMatrix with XYZ and YPR conversions
 */
define('phoria-gl-matrix', ['gl-matrix'], function(glMatrix) {

	// init glMatrix library - many small Arrays are faster without the use of Float32Array wrap/conversion
	glMatrix.glMatrix.setMatrixArrayType(Array);

	/**
	 * Creates a new vec3 initialized with the given xyz tuple
	 *
	 * @param {x:0,y:0,z:0} xyz object property tuple
	 * @returns {vec3} a new 3D vector
	 */
	glMatrix.vec3.fromXYZ = function(xyz) {
	   var out = new Array(3);
	   out[0] = xyz.x;
	   out[1] = xyz.y;
	   out[2] = xyz.z;
	   return out;
	};

	/**
	 * Creates a new xyz object initialized with the given vec3 values
	 *
	 * @param {vec3} 3D vector
	 * @returns {x:0,y:0,z:0} a new xyz object property tuple
	 */
	glMatrix.vec3.toXYZ = function(vec) {
	   return {x:vec[0], y:vec[1], z:vec[2]};
	};

	/**
	 * Creates a new vec4 initialized with the given xyz tuple and w coordinate
	 *
	 * @param {x:0,y:0,z:0} xyz object property tuple
	 * @param w {Number} w coordinate
	 * @returns {vec4} a new 4D vector
	 */
	glMatrix.vec4.fromXYZ = function(xyz, w) {
	   var out = new Array(4);
	   out[0] = xyz.x;
	   out[1] = xyz.y;
	   out[2] = xyz.z;
	   out[3] = w;
	   return out;
	};

	/**
	 * Creates a rotation matrix from the given yaw (heading), pitch (elevation) and roll (bank) Euler angles.
	 * 
	 * @param {mat4} out the receiving matrix
	 * @param {mat4} a the matrix to rotate
	 * @param {Number} yaw the yaw/heading angle in radians
	 * @param {Number} pitch the pitch/elevation angle in radians
	 * @param {Number} roll the roll/bank angle in radians
	 * @returns {mat4} out
	 */
	glMatrix.mat4.fromYPR = function(yaw, pitch, roll) {
	   var out = new Array(16);
	   var angles0 = Math.sin(roll),
	       angles1 = Math.cos(roll),
	       angles2 = Math.sin(pitch),
	       angles3 = Math.cos(pitch),
	       angles4 = Math.sin(yaw),
	       angles5 = Math.cos(yaw);
	   
	   out[0] = angles5 * angles1;
	   out[4] = -(angles5 * angles0);
	   out[8] = angles4;
	   out[1] = (angles2 * angles4 * angles1) + (angles3 * angles0);
	   out[5] = (angles3 * angles1) - (angles2 * angles4 * angles0);
	   out[9] = -(angles2 * angles5);
	   out[2] = (angles2 * angles0) - (angles3 * angles4 * angles1);
	   out[6] = (angles2 * angles1) + (angles3 * angles4 * angles0);
	   out[10] = angles3 * angles5;
	   out[3] = 0;
	   out[7] = 0;
	   out[11] = 0;
	   out[12] = 0;
	   out[13] = 0;
	   out[14] = 0;
	   out[15] = 1;
	   return out;
	};

	glMatrix.quat.fromYPR = function(yaw, pitch, roll) {
	    var num9 = roll * 0.5;
	    var num6 = Math.sin(num9);
	    var num5 = Math.cos(num9);
	    var num8 = pitch * 0.5;
	    var num4 = Math.sin(num8);
	    var num3 = Math.cos(num8);
	    var num7 = yaw * 0.5;
	    var num2 = Math.sin(num7);
	    var num = Math.cos(num7);
	    var out = new Array(4);
	    out[0] = ((num * num4) * num5) + ((num2 * num3) * num6);
	    out[1] = ((num2 * num3) * num5) - ((num * num4) * num6);
	    out[2] = ((num * num3) * num6) - ((num2 * num4) * num5);
	    out[3] = ((num * num3) * num5) + ((num2 * num4) * num6);
	    return out;
	};	

	return glMatrix;
})