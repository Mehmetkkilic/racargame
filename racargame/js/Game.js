import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger'; // Fizik kutularını görmek için

export class Game {
    constructor() {
        this.container = document.getElementById('canvas-container');
        
        // 1. Three.js Kurulumu
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xa0a0a0);
        this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 50); // İleriyi gizlemek için sis

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true; // Gölgeleri aç
        this.container.appendChild(this.renderer.domElement);

        // 2. Işıklandırma
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(20, 20, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // 3. Cannon-es Fizik Dünyası
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // Yerçekimi
        this.world.broadphase = new CANNON.SAPBroadphase(this.world); // Çarpışma performansı için

        // Materyaller (Sürtünme için önemli)
        this.groundMaterial = new CANNON.Material('ground');
        this.wheelMaterial = new CANNON.Material('wheel');
        
        const wheelGroundContact = new CANNON.ContactMaterial(
            this.wheelMaterial,
            this.groundMaterial,
            {
                friction: 0.3,
                restitution: 0,
                contactEquationStiffness: 1000
            }
        );
        this.world.addContactMaterial(wheelGroundContact);

        // Fizik Debugger (Geliştirme aşamasında fizik çizgilerini görmek için)
        // Oyun bitince bunu kapatacağız.
        this.physicsDebugger = new CannonDebugger(this.scene, this.world, {
            color: 0xffff00,
        });

        // 4. Zemin Oluşturma
        this.createGround();

        // 5. Loop Başlat
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Ekran boyutu değişirse
        window.addEventListener('resize', () => this.onResize());
    }

    createGround() {
        // Görsel Zemin
        const geometry = new THREE.PlaneGeometry(500, 500);
        const material = new THREE.MeshPhongMaterial({ color: 0x444444, depthWrite: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Fizik Zemin
        const groundBody = new CANNON.Body({
            mass: 0, // 0 kütle = Hareket etmeyen (Statik) obje
            material: this.groundMaterial
        });
        groundBody.addShape(new CANNON.Plane());
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Fizik motorunu güncelle (60 FPS için 1/60)
        this.world.step(1 / 60);

        // Debug çizgilerini çiz
        this.physicsDebugger.update();

        // Sahneyi çiz
        this.renderer.render(this.scene, this.camera);
    }
}