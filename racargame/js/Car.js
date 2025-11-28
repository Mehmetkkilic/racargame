import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Car {
    constructor(game, x, y, z) {
        this.game = game;
        this.scene = game.scene;
        this.world = game.world;
        
        // Görsel Parçalar (Three.js meshleri)
        this.chassisMesh = null;
        this.wheelMeshes = [];

        // Fizik Parçalar
        this.chassisBody = null;
        this.vehicle = null;

        this.createCar(x, y, z);
    }

    createCar(x, y, z) {
        // --- 1. Şasi (Gövde) ---
        const chassisDims = new THREE.Vector3(2, 0.5, 4); // Genişlik, Yükseklik, Uzunluk
        
        // Three.js Görseli
        const chassisGeo = new THREE.BoxGeometry(chassisDims.x, chassisDims.y, chassisDims.z);
        const chassisMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        this.chassisMesh.castShadow = true;
        this.scene.add(this.chassisMesh);

        // Cannon.js Fiziği
        const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisDims.x * 0.5, chassisDims.y * 0.5, chassisDims.z * 0.5));
        this.chassisBody = new CANNON.Body({ mass: 150 }); // 150kg (Hafif spor araba hissi için)
        this.chassisBody.addShape(chassisShape);
        this.chassisBody.position.set(x, y, z);
        this.chassisBody.angularDamping = 0.5; // Takla atmayı zorlaştırmak için dönüş sönümlemesi

        // --- 2. Araç Sistemi (RaycastVehicle) ---
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
        });

        // Tekerlek Ayarları
        const wheelOptions = {
            radius: 0.5,
            directionLocal: new CANNON.Vec3(0, -1, 0), // Tekerlek aşağı bakar
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.4,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01, // Virajda yatma oranı
            axleLocal: new CANNON.Vec3(-1, 0, 0), // Aksın yönü
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0), // Bağlantı noktası (sonra güncelleyeceğiz)
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        // Tekerlek Pozisyonları (Ön Sol, Ön Sağ, Arka Sol, Arka Sağ)
        // Aks genişliği ve uzunluğuna göre ayarlıyoruz
        const axleWidth = 0.8; 
        const axleFront = 1.2;
        const axleRear = -1.2;
        const height = -0.3; // Şasinin altından ne kadar aşağıda?

        // Ön Sol
        wheelOptions.chassisConnectionPointLocal.set(axleWidth, height, axleFront);
        this.vehicle.addWheel(wheelOptions);

        // Ön Sağ
        wheelOptions.chassisConnectionPointLocal.set(-axleWidth, height, axleFront);
        this.vehicle.addWheel(wheelOptions);

        // Arka Sol
        wheelOptions.chassisConnectionPointLocal.set(axleWidth, height, axleRear);
        this.vehicle.addWheel(wheelOptions);

        // Arka Sağ
        wheelOptions.chassisConnectionPointLocal.set(-axleWidth, height, axleRear);
        this.vehicle.addWheel(wheelOptions);

        // Aracı dünyaya ekle
        this.vehicle.addToWorld(this.world);

        // --- 3. Tekerlek Görselleri ---
        const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 20);
        wheelGeo.rotateZ(Math.PI / 2); // Silindiri yan çevir
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wheelMesh.castShadow = true;
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        }
    }

    update(input) {
        // Kontrol mantığı
        const maxSteerVal = 0.5;
        const maxForce = 1000;
        const brakeForce = 1000000;

        // Direksiyon (Sadece ön tekerler: index 0 ve 1)
        let steering = 0;
        if (input.keys.left) steering = maxSteerVal;
        if (input.keys.right) steering = -maxSteerVal;
        
        this.vehicle.setSteeringValue(steering, 0);
        this.vehicle.setSteeringValue(steering, 1);

        // Motor Gücü (Arka çekiş: index 2 ve 3) - 4 çeker istersen 0 ve 1'e de ekle
        let force = 0;
        if (input.keys.forward) force = -maxForce;
        if (input.keys.backward) force = maxForce;

        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);

        // Fren
        if (input.keys.brake) {
            this.vehicle.setBrake(brakeForce, 0);
            this.vehicle.setBrake(brakeForce, 1);
            this.vehicle.setBrake(brakeForce, 2);
            this.vehicle.setBrake(brakeForce, 3);
        } else {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(0, 2);
            this.vehicle.setBrake(0, 3);
        }

        // Görselleri Fizikle Eşle (Senkronizasyon)
        // 1. Şasiyi eşle
        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        // 2. Tekerlekleri eşle
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
    }
}