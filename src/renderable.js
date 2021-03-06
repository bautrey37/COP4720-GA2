
var lightValue = 1;
var nvalue = 100.0;

function changeLight(value) {
	lightValue = value;
	document.getElementById("myCanvas").focus();
	document.getElementById("button1").blur();
	document.getElementById("button2").blur();
}	

function changeN(value) {
	nvalue = 1100.0 - value;
    document.getElementById("myCanvas").focus();
    document.getElementById("LI").blur();
}

function RenderableModel(gl, model) {
    function Drawable(vArrays, nVertices, indexArray, drawMode, diffuse, ambient, texOb) {
        // Create a buffer object
        var vertexBuffers = [];
        var nElements = [];
        var nAttributes = vArrays.length;
        var attributesEnabled = [];
	  
        for (var i = 0; i < nAttributes; i++) {
            if (vArrays[i]) {
                vertexBuffers[i] = gl.createBuffer();
                if (!vertexBuffers[i]) {
                    console.log('Failed to create the buffer object');
                    return;
                }

                // Bind the buffer object to an ARRAY_BUFFER target
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[i]);
                // Write date into the buffer object
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vArrays[i]), gl.STATIC_DRAW);
                nElements[i] = vArrays[i].length / nVertices;
            }
            else {
                vertexBuffers[i] = null;
                attributesEnabled[i] = true;
            }
        }

        var indexBuffer = null;
        if (indexArray) {
            indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);
        }

        this.draw = function (attribLocations) {
            //gets diffuse reflectance from json and sets it in the fragment shader
            gl.uniform4f(drLoc, diffuse[0], diffuse[1], diffuse[2], diffuse[3]);
            gl.uniform3f(amLoc, ambient[0], ambient[1], ambient[2]);

            //Texture0 - texture unit number, specifies which hardware component to use for textures, i think
            gl.activeTexture(gl.TEXTURE0); //switches textures
            gl.bindTexture(gl.TEXTURE_2D, texOb); //binds to vertices
            gl.uniform1i(samplerLoc, 0); //sets fragment shader sampler to 0

            for (var i = 0; i < nAttributes; i++) {
                if (vertexBuffers[i]) {
                    if (!attributesEnabled[i]) {
                        gl.enableVertexAttribArray(attribLocations[i]);
                        attributesEnabled[i] = true;
                    }
                    // Bind the buffer object to target
                    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[i]);
                    // Assign the buffer object to a_Position variable

                    gl.vertexAttribPointer(attribLocations[i], nElements[i], gl.FLOAT, false, 0, 0);
                }
                else {
                    if (attributesEnabled[i]) {
                        gl.disableVertexAttribArray(attribLocations[i]);
                        attributesEnabled[i] = false;
                    }
                }
            }
            if (indexBuffer) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                gl.drawElements(drawMode, indexArray.length, gl.UNSIGNED_SHORT, 0);
            }
            else {
                gl.drawArrays(drawMode, 0, nVertices);
            }
        }
    }

    var VSHADER_SOURCE =
        'attribute vec4 a_Position;\n' +
        'attribute vec4 a_Normal;\n' +
        'attribute vec2 a_texCoord;\n' +
        'uniform mat4 modelT, viewT, projT;\n' +
        'uniform mat4 u_ModelMatrix;\n' +    // Model matrix
        'uniform mat4 u_NormalMatrix;\n' +   // Transformation matrix of the normal
        'varying vec4 v_Color;\n' +
        'varying vec3 v_Normal;\n' +
        'varying vec3 v_Position;\n' +
        'varying vec2 v_texCoord;\n' +
        'void main() {\n' +
            'gl_Position = projT * viewT * modelT * a_Position;\n' +
            // Calculate the vertex position in the world coordinate
            'v_Position = vec3(viewT * modelT * a_Position);\n' +
            'v_Normal = normalize(vec3(viewT * u_NormalMatrix * vec4(a_Normal.xyz, 0)));\n' +
            'v_texCoord = a_texCoord;\n' + //pass data to fragment shader
        '}\n';

    // Fragment shader program
    var FSHADER_SOURCE =
        'precision mediump float;\n' +
        'uniform int light_type;\n' + // 0 - spot, 1 - omnia
        'uniform vec3 u_LightColor;\n' +     // Light color
        'uniform vec3 u_LightPosition;\n' +  // Position of the light source
        'uniform vec3 u_AmbientLight;\n' +   // Ambient light color
        'uniform vec4 u_diffuseReflectance;\n' +
        'uniform vec3 u_ambientReflectance;\n' +
		'uniform float u_N;\n' +
        'uniform sampler2D sampler;\n' +
        'varying vec3 v_Normal;\n' +
        'varying vec3 v_Position;\n' +
        'varying vec2 v_texCoord;\n' +
        'void main() {\n' +
            // Normalize the normal because it is interpolated and not 1.0 in length any more
            'vec3 normal = normalize(v_Normal);\n' +
            // Calculate the light direction and make its length 1.
            'vec3 lightDirection = normalize(-v_Position);\n' +
			'vec3 spotDirection = vec3(0.0, 0.0, -1.0);\n' +
            // The dot product of the light direction and the orientation of a surface (the normal)
            'float nDotL = max(dot(lightDirection, normal), 0.0);\n' +
            'vec3 diffuse;\n' +
            'if(light_type == 1) {\n' +
                // Calculate the final color from diffuse reflection and ambient reflection
                'diffuse = u_LightColor * u_diffuseReflectance.rgb * nDotL;\n' +
            '} else {\n' +
				'float costheta = dot(spotDirection, -lightDirection);\n' + 
				'float spotFactor = pow(costheta, u_N); \n' +
                'diffuse = u_diffuseReflectance.rgb * u_LightColor * max(nDotL, 0.0) * spotFactor; \n' +
            '}\n' +
            // Calculate the color due to diffuse and ambient reflection
            //'vec3 ambient = u_AmbientLight * u_ambientReflectance;\n' + //if ref is 0, then no ambient
            'vec3 ambient = u_AmbientLight;\n' + //constant ambient on all sides
            'vec3 texColor = texture2D(sampler, v_texCoord).rgb;\n' +
            // Add surface colors due to diffuse and ambient reflection
            'gl_FragColor = vec4(texColor*diffuse + ambient, 1.0);\n' +
        '}\n';
    var program = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!program) {
        console.log('Failed to create program');
        return;
    }

    var lightPosition = [0, 0, 0]; // Originally positioned at the eye.
    var a_Position = gl.getAttribLocation(program, 'a_Position');
    var a_Normal = gl.getAttribLocation(program, 'a_Normal');
    var a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
    var a_Locations = [a_Position, a_Normal, a_texCoord];
    // Get the location/address of the uniform variable inside the shader program.
    var mmLoc = gl.getUniformLocation(program, "modelT");
    var vmLoc = gl.getUniformLocation(program, "viewT");
    var pmLoc = gl.getUniformLocation(program, "projT");
    var u_NormalMatrix = gl.getUniformLocation(program, 'u_NormalMatrix');
    var u_LightColor = gl.getUniformLocation(program, 'u_LightColor');
    var u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
	var u_N = gl.getUniformLocation(program, 'u_N');
    var drLoc = gl.getUniformLocation(program, 'u_diffuseReflectance');
    var amLoc = gl.getUniformLocation(program, 'u_ambientReflectance');
	var u_AmbientLight = gl.getUniformLocation(program, 'u_AmbientLight');
    var light_type = gl.getUniformLocation(program, 'light_type');
    var samplerLoc = gl.getUniformLocation(program, 'sampler');

    var drawables = [];
    var modelTransformations = [];
    var nDrawables = 0;
    var nNodes = (model.nodes) ? model.nodes.length : 1;
    var drawMode = (model.drawMode) ? gl[model.drawMode] : gl.TRIANGLES;
	
    for (var i = 0; i < nNodes; i++) {
        var nMeshes = (model.nodes) ? (model.nodes[i].meshIndices.length) : (model.meshes.length);
        for (var j = 0; j < nMeshes; j++) {
            var index = (model.nodes) ? model.nodes[i].meshIndices[j] : j;
            var mesh = model.meshes[index];
            var materials = model.materials[mesh.materialIndex];
            drawables[nDrawables] = new Drawable(
                [mesh.vertexPositions, mesh.vertexNormals, (mesh.vertexTexCoordinates)?mesh.vertexTexCoordinates[0]:undefined],
                mesh.vertexPositions.length / 3,
                mesh.indices, drawMode, materials.diffuseReflectance, materials.ambientReflectance,
                materials.diffuseTexObj
            );

            var m = new Matrix4();
            if (model.nodes)
                m.elements = new Float32Array(model.nodes[i].modelMatrix);
            modelTransformations[nDrawables] = m;

            nDrawables++;
        }
    } //End of Renderable object call

    // Get the location/address of the vertex attribute inside the shader program.
    this.draw = function (pMatrix, vMatrix, mMatrix) {
        gl.useProgram(program);
		gl.uniform1f(u_N, nvalue);
        gl.uniform3f(u_LightColor, 1.0, 1.0, 1.0); //intensity (white)
        gl.uniform3f(u_LightPosition, lightPosition[0], lightPosition[1], lightPosition[2]); //at eye point
		gl.uniform3f(u_AmbientLight, 0.1, 0.1, 0.1);// Set the ambient light
        gl.uniformMatrix4fv(pmLoc, false, pMatrix.elements);
        gl.uniformMatrix4fv(vmLoc, false, vMatrix.elements);	
        gl.uniform1i(light_type, lightValue);

        for (var i = 0; i < nDrawables; i++) {
            var mMatrix2 = (mMatrix) ? (new Matrix4(mMatrix).multiply(modelTransformations[i]))
                    : modelTransformations[i];
            gl.uniformMatrix4fv(mmLoc, false, mMatrix2.elements);
            // Calculate matrix to transform normal based on the model matrix
            var normalMatrix = new Matrix4();
            normalMatrix.setInverseOf(mMatrix2);
            normalMatrix.transpose();
            // Pass the transformation matrix for normal to u_NormalMatrix
            gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

            drawables[i].draw(a_Locations);
        }
        gl.useProgram(null);
    };

    this.getBounds = function () // Computes Model bounding box
    {
        var xmin, xmax, ymin, ymax, zmin, zmax;
        var firstvertex = true;
        var nNodes = (model.nodes) ? model.nodes.length : 1;
        for (var k = 0; k < nNodes; k++) {
            var m = new Matrix4();
            if (model.nodes)m.elements = new Float32Array(model.nodes[k].modelMatrix);
 
            var nMeshes = (model.nodes) ? model.nodes[k].meshIndices.length : model.meshes.length;
            for (var n = 0; n < nMeshes; n++) {
                var index = (model.nodes) ? model.nodes[k].meshIndices[n] : n;
                var mesh = model.meshes[index];
                for (var i = 0; i < mesh.vertexPositions.length; i += 3) {
                    var vertex = m.multiplyVector4(new Vector4([mesh.vertexPositions[i], mesh.vertexPositions[i + 1], mesh.vertexPositions[i + 2], 1])).elements;
                    if (firstvertex) {
                        xmin = xmax = vertex[0];
                        ymin = ymax = vertex[1];
                        zmin = zmax = vertex[2];
                        firstvertex = false;
                    }
                    else {
                        if (vertex[0] < xmin) xmin = vertex[0];
                        else if (vertex[0] > xmax) xmax = vertex[0];
                        if (vertex[1] < ymin) ymin = vertex[1];
                        else if (vertex[1] > ymax) ymax = vertex[1];
                        if (vertex[2] < zmin) zmin = vertex[2];
                        else if (vertex[2] > zmax) zmax = vertex[2];
                    }
                }
            }
        }
        var dim = {};
        dim.min = [xmin, ymin, zmin];
        dim.max = [xmax, ymax, zmax];
        return dim;
    }
}
