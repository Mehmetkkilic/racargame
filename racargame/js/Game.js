import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import { Car } from './Car.js';
import { Input } from './Input.js';

export class Game {
    constructor() {
        this.container = document.getElementById('canvas-container');
        
        // --- 1. Three.js Sahne Kurulumu ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xa0a0a0);
        // İlerideki nesnelerin yumuşakça kaybolması için sis (Fog)
        this.scene.fog = new THREE.Fog(0xa0a0a0, 20, 100); 

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10); // Başlangıç kamera pozisyonu

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true; // Gölgeleri aç
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // --- 2. Işıklandırma ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Genel aydınlatma
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(50, 50, 50);
        dirLight.castShadow = true;
        
        // Gölge kalitesi ayarları
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        // Gölge alanını genişlet
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        
        this.scene.add(dirLight);

        // --- 3. Cannon-es Fizik Dünyası ---
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // Yerçekimi
        this.world.broadphase = new CANNON.SAPBroadphase(this.world); // Performanslı çarpışma hesaplaması

        // Materyaller (Sürtünme ve Sekme ayarları için)
        this.groundMaterial = new CANNON.Material('ground');
        this.wheelMaterial = new CANNON.Material('wheel');
        
        // Tekerlek ve Zemin arasındaki ilişki
        const wheelGroundContact = new CANNON.ContactMaterial(
            this.wheelMaterial,
            this.groundMaterial,
            {
                friction: 0.3, // Sürtünme (Yüksek olursa araba zor kayar)
                restitution: 0, // Sekme (0 = Zıplamaz)
                contactEquationStiffness: 1000
            }
        );
        this.world.addContactMaterial(wheelGroundContact);

        // Fizik Debugger (Sarı çizgiler - Oyun bitince kapatılabilir)
        this.physicsDebugger = new CannonDebugger(this.scene, this.world, {
            color: 0xffff00,
        });

        // --- 4. Nesnelerin Oluşturulması ---
        this.createGround();

        // Klavye dinleyicisi
        this.input = new Input();

        // Arabayı oluştur (Yerden biraz yukarıda: Y=4)
        this.playerCar = new Car(this, 0, 4, 0);

        // --- 5. Oyun Döngüsü Başlatma ---
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Ekran boyutu değişirse güncelle
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
            mass: 0, // 0 kütle = Hareket etmeyen (Statik)
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

        // Fizik motorunu güncelle (Standart 60 FPS adımı)
        this.world.step(1 / 60);

        // Arabayı ve Kamerayı Güncelle
        if (this.playerCar) {
            // 1. Arabanın girdilerini işle ve fiziği güncelle
            this.playerCar.update(this.input);

            // 2. TPS Kamera Takibi
            this.updateCamera();

            // 3. UI Hız Göstergesi
            // Cannon araç hızı m/s verir, km/h için 3.6 ile çarpılır
            // RaycastVehicle zaten bu değeri km/h olarak tutan bir özelliğe sahip olabilir
            // ama en temizi body hızını ölçmektir.
            const speedMs = this.playerCar.chassisBody.velocity.length();
            const speedKmh = speedMs * 3.6;
            
            const speedEl = document.querySelector('.speed');
            if(speedEl) {
                speedEl.innerText = Math.floor(speedKmh) + " km/h";
            }
        }

        // Debug çizgilerini çiz (Geliştirme aşamasında açık kalsın)
        this.physicsDebugger.update();

        // Sahneyi çiz
        this.renderer.render(this.scene, this.camera);
    }

    updateCamera() {
        // Arabanın şasisi yoksa işlem yapma
        if (!this.playerCar.chassisMesh) return;

        // Hedef Konum: Arabanın pozisyonu
        const carPos = this.playerCar.chassisMesh.position;
        const carQuat = this.playerCar.chassisMesh.quaternion;

        // Kamera Ofseti: Arabanın arkasında (z+10) ve yukarısında (y+5)
        // Bu vektörü arabanın dönüşüne göre çevirmemiz lazım
        const relativeCameraOffset = new THREE.Vector3(0, 5, 12);
        
        // Vektörü arabanın yönüne uygula
        const cameraOffset = relativeCameraOffset.applyMatrix4(this.playerCar.chassisMesh.matrixWorld);

        // Kamerayı hedef konuma yumuşakça (Lerp) kaydır
        // 0.1 değeri ne kadar hızlı takip edeceğini belirler (Düşük = Yumuşak/Gecikmeli)
        this.camera.position.lerp(cameraOffset, 0.1);

        // Kamera her zaman arabaya baksın (Hafif önüne bakması daha iyi hissettirir)
        const lookAtPos = new THREE.Vector3(0, 0, 0);
        lookAtPos.copy(carPos);
        lookAtPos.y += 2; // Arabanın biraz üstüne bak
        this.camera.lookAt(lookAtPos);
    }
}