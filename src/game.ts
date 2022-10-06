/*
  IMPORTANT: The tsconfig.json has been configured to include "node_modules/cannon/build/cannon.js"
*/
import * as utils from "@dcl/ecs-scene-utils";
import { Ball } from "./ball";
import { loadColliders } from "./wallCollidersSetup";
import { Arissa } from "./arissa";

// create sounds
const stadiumSound = new AudioClip("sounds/stade.mp3");
const stadiumSource = new AudioSource(stadiumSound);

const kickSound = new AudioClip("sounds/kick.mp3");
const kickSource = new AudioSource(kickSound);

// Create base scene
const baseScene: Entity = new Entity();
// baseScene.addComponent(new GLTFShape("models/baseScene.glb"));
baseScene.addComponent(new Transform());
baseScene.addComponent(stadiumSource);
engine.addEntity(baseScene);
stadiumSource.loop = true;
stadiumSource.volume = 5;
stadiumSource.playing = true;

// create goal
const goal = new Entity();

let BoxWCollisions = new BoxShape();
BoxWCollisions.withCollisions = true;

goal.addComponent(BoxWCollisions);
goal.addComponent(
    new Transform({
        position: new Vector3(2, 0.1, 15),
        scale: new Vector3(5, 4, 0.5),
        rotation: Quaternion.Euler(0, -90, 0),
    })
);

engine.addEntity(goal);

// Create score
let points = 0;

const score = new Entity();

const scoreCount = new TextShape(`Goals : ${points.toString()}`);
score.addComponent(scoreCount);

score.addComponent(new Billboard());
score.addComponent(
    new Transform({
        position: new Vector3(4, 4, 15),
    })
);

engine.addEntity(score);

// Create ball
const shape = new GLTFShape("models/blueBall.glb");

const ball2 = new Ball(
    shape,
    new Transform({
        position: new Vector3(16, 1, 16),
        scale: new Vector3(0.25, 0.25, 0.25),
    })
);
ball2.addComponent(kickSource);
kickSource.playing = false;

engine.addEntity(ball2);

// Create Button

const button = new Entity();
button.addComponent(new GLTFShape("models/button.glb"));
button.addComponent(
    new Transform({
        position: new Vector3(30, 0.1, 2),
        scale: new Vector3(0.7, 0.7, 0.7),
        rotation: Quaternion.Euler(0, -45, 0),
    })
);
engine.addEntity(button);

// modifier area

const modArea = new Entity();
modArea.addComponent(
    new AvatarModifierArea({
        area: { box: new Vector3(32, 4, 32) },
        modifiers: [AvatarModifiers.HIDE_AVATARS],
    })
);
modArea.addComponent(
    new Transform({
        position: new Vector3(16, 0, 16),
    })
);

// Arissa
const arissa = new Arissa(
    new GLTFShape("models/arissa.glb"),
    new Transform({
        position: new Vector3(0, 0.05, -0.1),
        scale: new Vector3(0, 0, 0),
    })
);
arissa.setParent(Attachable.AVATAR);

// Check if player is moving
const currentPosition = new Vector3();

class CheckPlayerIsMovingSystem implements ISystem {
    update() {
        if (currentPosition.equals(Camera.instance.position)) {
            arissa.playIdle();
        } else {
            currentPosition.copyFrom(Camera.instance.position);
            arissa.playRunning();
        }
    }
}
engine.addSystem(new CheckPlayerIsMovingSystem());

// button function
button.addComponent(
    new utils.ToggleComponent(utils.ToggleState.Off, (value) => {
        if (value === utils.ToggleState.On) {
            engine.removeEntity(modArea);
            arissa.getComponent(Transform).scale.setAll(0);
        } else {
            engine.addEntity(modArea);
            arissa.getComponent(Transform).scale.setAll(1);
        }
    })
);
button.addComponent(
    new OnPointerDown((e) => {
        button.getComponent(utils.ToggleComponent).toggle();
    })
);

// Vectors
let forwardVector: Vector3 = Vector3.Forward().rotate(Camera.instance.rotation); // Camera's forward vector
let goalVector: Vector3 = Vector3.Right();
const vectorScale: number = 100;
const vectorScaleRebound: number = 500;

// check distance for blue ball
const playerKick = () => {
    const kick = ball2Body.applyImpulse(
        new CANNON.Vec3(
            forwardVector.x * vectorScale,
            forwardVector.y * vectorScale,
            forwardVector.z * vectorScale
        ),
        ball2Body.position
    );
    kickSource.playing = true;
};
const soundOff = () => {
    kickSource.playing = false;
};
const wallRebound = () => {
    const rebound = ball2Body.applyImpulse(
        new CANNON.Vec3(
            goalVector.x * vectorScaleRebound,
            goalVector.y * vectorScaleRebound,
            goalVector.z * vectorScaleRebound
        ),
        ball2Body.position
    );
    points += 1;
    score.getComponent(TextShape).value = `Goals : ${points.toString()}`;
    log(points);
};

// proximity between ball and player
export class Proximity implements ISystem {
    update() {
        const transform = ball2.getComponent(Transform);
        const dist = distance(transform.position, Camera.instance.position);
        if (dist <= 0.8) {
            playerKick();
        } else {
            soundOff();
        }
    }
}
export class ProximityWB implements ISystem {
    update() {
        const transformBall = ball2.getComponent(Transform);
        const transformGoal = goal.getComponent(Transform);
        const dist = distanceWB(transformBall.position, transformGoal.position);
        if (dist <= 0.5) {
            wallRebound();
        }
    }
}

engine.addSystem(new Proximity());
engine.addSystem(new ProximityWB());

// Get distance
/*
Note:
This function really returns distance squared, as it's a lot more efficient to calculate.
The square root operation is expensive and isn't really necessary if we compare the result to squared values.
We also use {x,z} not {x,y}. The y-coordinate is how high up it is.
*/
function distance(pos1: Vector3, pos2: Vector3): number {
    const a = pos2.x - pos1.x;
    const b = pos2.z - pos1.z;
    const squareRoot = Math.sqrt(a * a + b * b);
    return squareRoot;
}

const distanceWB = (pos1: Vector3, pos2: Vector3): number => {
    const a = pos2.x - pos1.x;
    const wXStart = pos2.z - 2.5;
    const wXEnd = pos2.z + 2.5;
    const hYStart = pos2.y - 2;
    const hYEnd = pos2.y + 2;

    if (pos1.z >= wXStart && pos1.z <= wXEnd && pos1.y <= hYEnd) {
        return a * a;
    }
};

// Setup our world
const world: CANNON.World = new CANNON.World();
world.gravity.set(0, -9.82, 0); // m/s²

// Add invisible colliders
loadColliders(world);

const groundPhysicsMaterial = new CANNON.Material("groundMaterial");
const groundPhysicsContactMaterial = new CANNON.ContactMaterial(
    groundPhysicsMaterial,
    groundPhysicsMaterial,
    {
        friction: 0.5,
        restitution: 0.33,
    }
);
world.addContactMaterial(groundPhysicsContactMaterial);

// Create a ground plane and apply physics material
const groundBody: CANNON.Body = new CANNON.Body({
    mass: 0, // mass === 0 makes the body static
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Reorient ground plane to be in the y-axis

const groundShape: CANNON.Plane = new CANNON.Plane();
groundBody.addShape(groundShape);
groundBody.material = groundPhysicsMaterial;
world.addBody(groundBody);

// create button physics material
const buttonPhysicsMaterial: CANNON.Material = new CANNON.Material(
    "buttonMaterial"
);
const buttonPhysicsContactMaterial = new CANNON.ContactMaterial(
    groundPhysicsMaterial,
    buttonPhysicsMaterial,
    {
        friction: 0.4,
        restitution: 0.75,
    }
);
world.addContactMaterial(buttonPhysicsContactMaterial);

const buttonTransform = button.getComponent(Transform);
const buttonBody: CANNON.Body = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(
        buttonTransform.position.x,
        buttonTransform.position.y,
        buttonTransform.position.z
    ),
    shape: new CANNON.Box(new CANNON.Vec3(1, 2, 1)),
});
buttonBody.material = new CANNON.Material("buttonMaterial");
world.addBody(buttonBody);

// Create bodies to represent the ball
const ballPhysicsMaterial: CANNON.Material = new CANNON.Material(
    "ballMaterial"
);
const ballPhysicsContactMaterial = new CANNON.ContactMaterial(
    groundPhysicsMaterial,
    ballPhysicsMaterial,
    {
        friction: 0.4,
        restitution: 0.75,
    }
);
world.addContactMaterial(ballPhysicsContactMaterial);

const ball2Transform = ball2.getComponent(Transform);
const ball2Body = new CANNON.Body({
    mass: 5,
    position: new CANNON.Vec3(
        ball2Transform.position.x,
        ball2Transform.position.y,
        ball2Transform.position.z
    ),
    shape: new CANNON.Sphere(0.4),
});

ball2Body.material = ballPhysicsMaterial;
ball2Body.linearDamping = 0.4;
ball2Body.angularDamping = 0.4;

world.addBody(ball2Body);

const fixedTimeStep: number = 1.0 / 60.0; // seconds
const maxSubSteps: number = 3;

class updateSystem implements ISystem {
    update(dt: number): void {
        // Instruct the world to perform a single step of simulation.
        // It is generally best to keep the time step and iterations fixed.
        world.step(fixedTimeStep, dt, maxSubSteps);

        // Position and rotate the balls in the scene to match their cannon world counterparts
        ball2.getComponent(Transform).position.copyFrom(ball2Body.position);
        ball2.getComponent(Transform).rotation.copyFrom(ball2Body.quaternion);

        // Update forward vector
        forwardVector = Vector3.Forward().rotate(Camera.instance.rotation);
    }
}

engine.addSystem(new updateSystem());
