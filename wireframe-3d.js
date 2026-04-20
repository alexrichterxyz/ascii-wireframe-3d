const PHI = (1 + Math.sqrt(5)) / 2;

// matrix a is N x 3 and b is 3 x 3
function mat3Multiply(a, b) {
	const out = new Array(a.length);
	for (let i = 0; i < a.length; i++) {
		const r = a[i];
		out[i] = [
			r[0] * b[0][0] + r[1] * b[1][0] + r[2] * b[2][0],
			r[0] * b[0][1] + r[1] * b[1][1] + r[2] * b[2][1],
			r[0] * b[0][2] + r[1] * b[1][2] + r[2] * b[2][2],
		];
	}
	return out;
}

function rotX(a) {
	const c = Math.cos(a), s = Math.sin(a);
	return [[1, 0, 0], [0, c, -s], [0, s, c]];
}

function rotY(a) {
	const c = Math.cos(a), s = Math.sin(a);
	return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}

function rotZ(a) {
	const c = Math.cos(a), s = Math.sin(a);
	return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

// distance between 2 points
function dist(a, b) {
	const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// normalizes all vertices to fit within a unit sphere
function unitize(verts) {
	let max = 0;
	for (const v of verts) {
		const d = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
		if (d > max) max = d;
	}
	if (max === 0) return verts;
	return verts.map(v => [v[0] / max, v[1] / max, v[2] / max]);
}

// find edges by connecting vertices that are nearest neighbors
function edgesByLength(verts) {
	let min = Infinity;
	for (let i = 0; i < verts.length; i++)
		for (let j = i + 1; j < verts.length; j++) {
			const d = dist(verts[i], verts[j]);
			if (d < min) min = d;
		}
	const edges = [];
	for (let i = 0; i < verts.length; i++)
		for (let j = i + 1; j < verts.length; j++)
			if (Math.abs(dist(verts[i], verts[j]) - min) < 0.01) edges.push([i, j]);
	return edges;
}

// takes raw vertices, unitizes them, derives edges automatically
function solid(raw) {
	const v = unitize(raw);
	return { vertices: v, edges: edgesByLength(v) };
}

// generate all combinations of +1/-1 signs in 2D
function signs2(fn) {
	for (let a = -1; a <= 1; a += 2)
		for (let b = -1; b <= 1; b += 2) fn(a, b);
}

// generate all combinations of +1/-1 signs in 3D
function signs3(fn) {
	for (let a = -1; a <= 1; a += 2)
		for (let b = -1; b <= 1; b += 2)
			for (let c = -1; c <= 1; c += 2) fn(a, b, c);
}

const SHAPES = {
	tetrahedron() {
		return solid([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
	},

	cube() {
		const v = [];
		signs3((a, b, c) => v.push([a, b, c]));
		return solid(v);
	},

	octahedron() {
		return solid([
			[1, 0, 0], [-1, 0, 0],
			[0, 1, 0], [0, -1, 0],
			[0, 0, 1], [0, 0, -1],
		]);
	},

	dodecahedron() {
		const ip = 1 / PHI, v = [];
		signs3((a, b, c) => v.push([a, b, c]));
		signs2((a, b) => v.push([0, a * ip, b * PHI]));
		signs2((a, b) => v.push([a * ip, b * PHI, 0]));
		signs2((a, b) => v.push([a * PHI, 0, b * ip]));
		return solid(v);
	},

	icosahedron() {
		const v = [];
		signs2((a, b) => v.push([0, a, b * PHI]));
		signs2((a, b) => v.push([a, b * PHI, 0]));
		signs2((a, b) => v.push([a * PHI, 0, b]));
		return solid(v);
	},

	torus(ringRadius = 0.6, tubeRadius = 0.25, segments = 6, rings = 6) {
		const vertices = [], edges = [];

		for (let i = 0; i < rings; i++) {
			const theta = (i / rings) * Math.PI * 2;
			for (let j = 0; j < segments; j++) {
				const phi = (j / segments) * Math.PI * 2;
				vertices.push([
					(ringRadius + tubeRadius * Math.cos(phi)) * Math.cos(theta),
					(ringRadius + tubeRadius * Math.cos(phi)) * Math.sin(theta),
					tubeRadius * Math.sin(phi),
				]);

				const curr = i * segments + j;
				const nextJ = i * segments + (j + 1) % segments;
				const nextI = ((i + 1) % rings) * segments + j;
				edges.push([curr, nextJ]); // ring edge
				edges.push([curr, nextI]); // tube edge
			}
		}

		return { vertices, edges };
	}
};

function makeBuffer(w, h) {
	return Array.from({ length: h }, () => new Array(w).fill(' '));
}

function cloneBuffer(buf) {
	return buf.map(row => row.slice());
}

function stampText(text, buf) {
	if (!text) return;
	const lines = text.split('\n');
	const y0 = Math.round((buf.length - lines.length) / 2);
	for (let l = 0; l < lines.length; l++) {
		const x0 = Math.round((buf[0].length - lines[l].length) / 2);
		for (let c = 0; c < lines[l].length; c++) {
			const yy = y0 + l, xx = x0 + c;
			if (yy >= 0 && yy < buf.length && xx >= 0 && xx < buf[0].length)
				buf[yy][xx] = lines[l][c];
		}
	}
}

function drawLine(p1, p2, buf, chars) {
	const w = buf[0].length, h = buf.length;
	const x1 = w / 2 * (1 + p1[0]), y1 = h / 2 * (1 - p1[1]);
	const x2 = w / 2 * (1 + p2[0]), y2 = h / 2 * (1 - p2[1]);
	const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)));
	if (steps === 0) return;
	const xi = (x2 - x1) / steps, yi = (y2 - y1) / steps;
	for (let i = 0; i <= steps; i++) {
		const x = Math.round(x1 + xi * i), y = Math.round(y1 + yi * i);
		if (x >= 0 && x < w && y >= 0 && y < h)
			buf[y][x] = chars[i % chars.length];
	}
}

function drawVertices(verts, buf, ch) {
	if (!ch) return;
	const w = buf[0].length, h = buf.length;
	for (const v of verts) {
		const x = Math.round(w / 2 * (1 + v[0]));
		const y = Math.round(h / 2 * (1 - v[1]));
		if (x >= 0 && x < w && y >= 0 && y < h) buf[y][x] = ch;
	}
}

function bufToString(buf) {
	return buf.map(row => row.join('')).join('\n');
}


class Wireframe3D {
	static shapes = SHAPES;

	#baseVerts;
	#verts;
	#edges;
	#shapeName;

	#width;
	#height;
	#scale;
	#speed;
	#chars;
	#vertexChar;
	#text;
	#autoSpin;
	#spinDelay;
	#lock;
	#sensitivity;
	#mouse;
	#touch;

	#angle;
	#spinning;
	#lastTime = null;
	#rafId = null;
	#timeout = null;
	#lastPointer = null;
	#destroyed = false;

	#pre;
	#base;

	constructor(container, options = {}) {
		if (!container) throw new Error('Wireframe3D: container element required');

		const {
			shape = 'cube', // one of cube, torus, tetrahedron, octahedron, dodecahedron, or icosahedron
			vertices = null, // custom vertices
			edges = null, // custom edges
			width = 80, // number of horizontal characters
			height = 40, // number of vertical characters
			scale = 1.0, // scale factor of user-provided vertices
			speed = {}, // rotation speed per axis
			chars = '*', // characters cycled along edges
			vertexChar = null, // character drawn at vertices
			text = null, // centered overlay text
			mouse = true, // mouse interaction enabled
			touch = true, // touch interaction enabled
			autoSpin = true, // resume spinning after mouse interaction
			spinDelay = 1000, // ms before auto-spin resumes
			lock = {}, // which axes are frozen
			sensitivity = 0.005, // sensitivity to mouse movement or touch
			angle = {}
		} = options;

		this.#width = width;
		this.#height = height;
		this.#scale = scale;
		this.#speed = { x: 0.0009, y: 0.0015, z: 0, ...speed };
		this.#chars = chars;
		this.#vertexChar = vertexChar;
		this.#text = text;
		this.#autoSpin = autoSpin;
		this.#spinDelay = spinDelay;
		this.#lock = { x: false, y: false, z: false, ...lock };
		this.#sensitivity = sensitivity;
		this.#spinning = autoSpin;
		this.#mouse = mouse;
		this.#touch = touch;
		this.#angle = { x: 0, y: 0, z: 0, ...angle };

		if (vertices && edges) {
			this.#baseVerts = unitize(vertices);
			this.#edges = edges;
			this.#shapeName = null;
		} else {
			this.#loadShape(shape);
		}

		this.#verts = this.#scaledVerts();

		this.#pre = document.createElement('pre');
		container.appendChild(this.#pre);

		this.#base = makeBuffer(this.#width, this.#height);
		stampText(this.#text, this.#base);

		if (mouse) window.addEventListener('mousemove', this.#onMouse);
		if (touch) {
			window.addEventListener('touchmove', this.#onTouch, { passive: true });
			window.addEventListener('touchend', this.#onTouchEnd);
		}

		if (this.#spinning) this.#rafId = requestAnimationFrame(this.#tick);
		else this.#render();
	}

	#loadShape(name) {
		if (!SHAPES[name]) throw new Error(`Wireframe3D: unknown shape "${name}"`);
		const s = SHAPES[name]();
		this.#baseVerts = s.vertices;
		this.#edges = s.edges;
		this.#shapeName = name;
	}

	#scaledVerts() {
		const s = this.#scale;
		return this.#baseVerts.map(v => [v[0] * s, v[1] * s, v[2] * s]);
	}

	#rebuildBase() {
		this.#base = makeBuffer(this.#width, this.#height);
		stampText(this.#text, this.#base);
	}

	#render() {
		const buf = cloneBuffer(this.#base);
		let t = this.#verts;
		if (!this.#lock.x) t = mat3Multiply(t, rotX(this.#angle.x));
		if (!this.#lock.y) t = mat3Multiply(t, rotY(this.#angle.y));
		if (!this.#lock.z) t = mat3Multiply(t, rotZ(this.#angle.z));
		for (const [a, b] of this.#edges) drawLine(t[a], t[b], buf, this.#chars);
		drawVertices(t, buf, this.#vertexChar);
		this.#pre.textContent = bufToString(buf);
	}

	#tick = (now) => {
		if (this.#destroyed || !this.#spinning) { this.#lastTime = null; return; }
		const dt = this.#lastTime !== null ? now - this.#lastTime : 0;
		this.#lastTime = now;
		if (!this.#lock.x) this.#angle.x += this.#speed.x * dt;
		if (!this.#lock.y) this.#angle.y += this.#speed.y * dt;
		if (!this.#lock.z) this.#angle.z += this.#speed.z * dt;
		this.#render();
		this.#rafId = requestAnimationFrame(this.#tick);
	};

	#onPointer(px, py) {
		if (this.#destroyed) return;
		clearTimeout(this.#timeout);
		this.#spinning = false;
		cancelAnimationFrame(this.#rafId);

		if (this.#lastPointer) {
			if (!this.#lock.y) this.#angle.y += (this.#lastPointer.x - px) * this.#sensitivity;
			if (!this.#lock.x) this.#angle.x += (this.#lastPointer.y - py) * this.#sensitivity;
		}
		this.#lastPointer = { x: px, y: py };
		this.#render();

		if (this.#autoSpin) {
			this.#timeout = setTimeout(() => {
				this.#lastPointer = null;
				this.#spinning = true;
				this.#rafId = requestAnimationFrame(this.#tick);
			}, this.#spinDelay);
		}
	}

	#onMouse = (e) => this.#onPointer(e.pageX, e.pageY);

	#onTouch = (e) => {
		if (e.touches.length) this.#onPointer(e.touches[0].pageX, e.touches[0].pageY);
	};

	#onTouchEnd = () => { this.#lastPointer = null; };

	get shape() { return this.#shapeName; }

	set shape(name) {
		this.#loadShape(name);
		this.#verts = this.#scaledVerts();
		this.#render();
	}

	get scale() { return this.#scale; }

	set scale(val) {
		this.#scale = val;
		this.#verts = this.#scaledVerts();
		this.#render();
	}

	get speed() { return { ...this.#speed }; }

	set speed(val) { Object.assign(this.#speed, val); }

	get lock() { return { ...this.#lock }; }

	set lock(val) { Object.assign(this.#lock, val); }

	get angle() { return { ...this.#angle }; }

	set angle(val) {
		Object.assign(this.#angle, val);
		this.#render();
	}

	get chars() { return this.#chars; }

	set chars(val) { this.#chars = val; this.#render(); }

	get vertexChar() { return this.#vertexChar; }

	set vertexChar(val) { this.#vertexChar = val; this.#render(); }

	get text() { return this.#text; }

	set text(val) {
		this.#text = val;
		this.#rebuildBase();
		this.#render();
	}

	get width() { return this.#width; }

	get height() { return this.#height; }

	get spinning() { return this.#spinning; }

	start() {
		this.#spinning = true;
		this.#rafId = requestAnimationFrame(this.#tick);
	}

	stop() {
		this.#spinning = false;
		cancelAnimationFrame(this.#rafId);
	}

	render() {
		this.#render();
	}

	resize(w, h) {
		this.#width = w;
		this.#height = h;
		this.#rebuildBase();
		this.#render();
	}

	setGeometry(vertices, edges) {
		this.#baseVerts = unitize(vertices);
		this.#edges = edges;
		this.#shapeName = null;
		this.#verts = this.#scaledVerts();
		this.#render();
	}

	destroy() {
		this.#destroyed = true;
		cancelAnimationFrame(this.#rafId);
		clearTimeout(this.#timeout);
		window.removeEventListener('mousemove', this.#onMouse);
		window.removeEventListener('touchmove', this.#onTouch);
		window.removeEventListener('touchend', this.#onTouchEnd);
		this.#pre.remove();
	}
}

export default Wireframe3D;