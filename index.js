const renderLineVertex = `#version 300 es

precision highp float;

layout (location = 0) in float i_value;

uniform float u_length;
uniform float u_minValue;
uniform float u_maxValue;

#define linearstep(edge0, edge1, x) max(min((x - edge0) / (edge1 - edge0), 1.0), 0.0)

void main(void) {
  gl_Position = vec4(
    (float(gl_VertexID) / u_length) * 2.0 - 1.0,
    linearstep(u_minValue, u_maxValue, i_value) * 2.0 - 1.0,
    0.0,
    1.0
  );
}
`;

const renderLineFragment = `#version 300 es

precision highp float;

out vec4 o_color;

uniform vec3 u_color;

void main(void) {
  o_color = vec4(u_color, 1.0);
}
`;

function createShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) + source);
  }
  return shader;
}

function createProgram(gl, vertShader, fragShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

function getUniformLocs(gl, program, names) {
  const map = new Map();
  names.forEach((name) => map.set(name, gl.getUniformLocation(program, name)));
  return map;
}

function createVbo(gl, array, usage) {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, array, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return vbo;
}

const clickElem = document.createElement('div');
clickElem.textContent = 'Click to Start';
document.body.appendChild(clickElem);

let clicked = false;
addEventListener('click', async () => {
  if (clicked) return;
  clicked = true;
  clickElem.remove();

  const audioCtx = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({audio: true});
  const input  = audioCtx.createMediaStreamSource(stream);
  const analyzer = audioCtx.createAnalyser();
  input.connect(analyzer);

  const canvas = document.createElement('canvas');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl2');
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  const program = createProgram(gl,
    createShader(gl, renderLineVertex, gl.VERTEX_SHADER),
    createShader(gl, renderLineFragment, gl.FRAGMENT_SHADER)
  );
  const uniformLocs = getUniformLocs(gl, program, ['u_length', 'u_minValue', 'u_maxValue', 'u_color']);

  const timeDomainArray = new Float32Array(analyzer.fftSize);
  const frequencyArray = new Float32Array(analyzer.frequencyBinCount);
  const timeDomainVbo = createVbo(gl, timeDomainArray, gl.DYNAMIC_DRAW);
  const frequencyVbo = createVbo(gl, frequencyArray, gl.DYNAMIC_DRAW);

  let requestId =  null;
  const render = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);

    analyzer.getFloatTimeDomainData(timeDomainArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, timeDomainVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, timeDomainArray);

    gl.useProgram(program);
    gl.uniform1f(uniformLocs.get('u_length'), timeDomainArray.length);
    gl.uniform1f(uniformLocs.get('u_minValue'), -1.0);
    gl.uniform1f(uniformLocs.get('u_maxValue'), 1.0);
    gl.uniform3f(uniformLocs.get('u_color'), 1.0, 0.0, 0.0);
    gl.bindBuffer(gl.ARRAY_BUFFER, timeDomainVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINE_STRIP, 0, timeDomainArray.length);

    analyzer.getFloatFrequencyData(frequencyArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, frequencyVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, frequencyArray);

    gl.uniform1f(uniformLocs.get('u_length'), frequencyArray.length);
    gl.uniform1f(uniformLocs.get('u_minValue'), analyzer.minDecibels);
    gl.uniform1f(uniformLocs.get('u_maxValue'), analyzer.maxDecibels);
    gl.uniform3f(uniformLocs.get('u_color'), 0.0, 0.0, 1.0);
    gl.bindBuffer(gl.ARRAY_BUFFER, frequencyVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINE_STRIP, 0, frequencyArray.length);

    requestId = requestAnimationFrame(render);
  };

  addEventListener('resize', () => {
    if (requestId != null) {
      cancelAnimationFrame(requestId);
    }
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    gl.viewport(0.0, 0.0, canvas.width, canvas.height);
    requestId = requestAnimationFrame(render);
  });

  requestId = requestAnimationFrame(render);
});