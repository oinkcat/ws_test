// WebSocket client
declare var $: JQueryStatic;

/** Realtime WebSocket test client */
module Client {

    const WS_ENDPOINT: string = "ws://localhost:1234/ws/";

    const SESSION_START_TOKEN: string = "start";

    /** Tell that functionality is not implemented */
    class NotImplementedError extends Error {
        constructor() {
            super("Not implemented!");
        }
    }

    /** Numeric id to object mapping */
    interface IIdentMap<T> {
        [key: number]: T;
    }

    /** Page */
    class PageView {
        public displayOK(): void {
            $('.state-ok').removeClass('hidden');
        }

        public displayError(): void {
            $('.state-err').removeClass('hidden');
        }

        /** Update list of connected clients */
        public refreshClientsList(state: State): void {
            let container = $('.main .panel-body');
            container.empty();

            let getEntityLayout = (entity: Entity) => {
                return $("<div>").text(entity.name);
            };

            // Player name
            getEntityLayout(state.player).appendTo(container);

            // Other entities
            Object.keys(state.others).forEach(entId => {
                let entity = state.others[entId];
                getEntityLayout(entity).appendTo(container);
            });
        }

    }

    /** Field on canvas */
    class FieldView {

        private canvas: HTMLCanvasElement;

        private ctx: CanvasRenderingContext2D;

        private state: State;

        /** Set state data */
        public setState(state: State) {
            if (this.state == null) {
                this.state = state;
            }
        }

        // Render message
        private renderBanner(): void {
            const MESSAGE: string = "Waiting...";

            this.ctx.fillStyle = "gray";
            this.ctx.font = "14pt Tahoma";
            let msgWidth = this.ctx.measureText(MESSAGE).width;

            let txtX = (this.canvas.width - msgWidth) / 2;
            let txtY = this.canvas.height / 2 - 10;
            this.ctx.fillText(MESSAGE, txtX, txtY);
        }

        // Get camera position
        private getCamera(): Box {
            let w = this.canvas.width;
            let h = this.canvas.height;
            let maxCamX = this.state.fieldSize - w;
            let maxCamY = this.state.fieldSize - h;
            let objPos = this.state.player.position;

            let camera = new Box(0, 0, w, h);

            // Horizontal
            if (objPos.x > maxCamX + w / 2) {
                camera.x = maxCamX;
            } else if (objPos.x > w / 2) {
                camera.x = objPos.x - w / 2;
            } 

            // Vertical
            if (objPos.y > maxCamY + h / 2) {
                camera.y = maxCamY;
            } else if(objPos.y > h / 2) {
                camera.y = objPos.y - h / 2;
            } 

            return camera;
        }

        // Get all obstacles in given viewport
        private getObstaclesInView(view: Box): Box[] {
            let endX = view.x + view.w;
            let endY = view.y + view.h;

            return this.state.obstacles.filter(box => {
                let itemEndX = box.x + box.w;
                if (view.x < itemEndX && endX > box.x) {
                    let itemEndY = box.y + box.h;
                    return view.y < itemEndY && endY > box.y;
                }
                return false;
            });
        }

        // Render one entity
        private renderEntity(entity: Entity, camera: Box): void {
            let isMe = entity == this.state.player;
            this.ctx.fillStyle = isMe ? "green" : "blue";
            let pos = entity.position;
            let s = this.state.size;
            let vel = entity.velocity;

            let vX = entity.position.x - camera.x;
            let vY = entity.position.y - camera.y;
            let angle = Math.atan2(vel.y, vel.x);
            let pX = Math.cos(angle) * 20 + vX;
            let pY = Math.sin(angle) * 20 + vY;
            this.ctx.fillRect(vX - s / 2, vY - s / 2, s, s);

            this.ctx.strokeStyle = "black";
            this.ctx.beginPath();
            this.ctx.moveTo(vX, vY);
            this.ctx.lineTo(pX, pY);
            this.ctx.stroke();
        }

        // Render field
        private renderField(): void {
            const GRID_STEP: number = 50;

            let w = this.canvas.width;
            let h = this.canvas.height;

            this.ctx.clearRect(0, 0, w, h);

            let cam: Box = this.getCamera();

            // Gridlines
            this.ctx.strokeStyle = "gray";
            this.ctx.beginPath();
            let nLines = Math.floor(w / GRID_STEP) + 2;
            for (let i = 0; i < nLines; i++) {
                let lX = i * GRID_STEP - (cam.x % GRID_STEP);
                let lY = i * GRID_STEP - (cam.y % GRID_STEP);
                this.ctx.moveTo(lX, 0);
                this.ctx.lineTo(lX, h);
                if (lY < h) {
                    this.ctx.moveTo(0, lY);
                    this.ctx.lineTo(w, lY);
                }
            }
            this.ctx.stroke();

            // Obstacles
            let allBoxesInView = this.getObstaclesInView(cam);
            this.ctx.fillStyle = "#ddddee";
            this.ctx.strokeStyle = "#8888aa";
            for (let box of allBoxesInView) {
                let boxVX = box.x - cam.x;
                let boxVY = box.y - cam.y;
                this.ctx.fillRect(boxVX, boxVY, box.w, box.h);
                this.ctx.strokeRect(boxVX, boxVY, box.w, box.h);
            }

            // Entities
            this.renderEntity(this.state.player, cam);
            for (let anotherId of Object.keys(this.state.others)) {
                let another = this.state.others[anotherId];
                if (cam.contains(another.position)) {
                    this.renderEntity(another, cam);
                }
            }
        }

        /** Render field */
        public render(): void {
            if (state != null && state.loaded) {
                this.renderField();
            } else {
                this.renderBanner();
            }
        }

        constructor(canvas) {
            this.canvas = canvas[0];
            this.ctx = this.canvas.getContext("2d");
        }
    }

    /** Two dimensional vector */
    class Vector {
        /** Add vector to vector */
        public add(another: Vector): void {
            this.x += another.x;
            this.y += another.y;
        }

        constructor(public x: number, public y: number) { }
    }

    /** Two dimensional rectangle */
    class Box {

        /** Deternine if box contains point */
        public contains(point: Vector): boolean {
            return (point.x >= this.x) && (point.x <= this.x + this.w) &&
                   (point.y >= this.y) && (point.y <= this.y + this.h);
        }

        constructor(
            public x: number, public y: number,
            public w: number, public h: number
        ) { }
    }

    /** Entity on field */
    class Entity {

        /** Position coordinate */
        public position: Vector;

        /** Entity velocity */
        public velocity: Vector;

        /** Move entity with current velocity */
        public moveForward(): void {
            this.position.add(this.velocity);
        }

        constructor(public id: number, public name: string) {
            this.position = new Vector(-1, -1);
            this.velocity = new Vector(0, 0);
        }
    }

    /** Type of communication message */
    enum MessageType {
        Close, FieldParams,
        CheckMove, MoveAnswer,
        EntitiesInfo, ConnectedInfo
    }

    /** Base communication message */
    abstract class Message {
        // Message data holder
        protected buffer: ArrayBuffer;

        protected bufferView: Uint8Array;

        private bufferPos: number;

        /** Create message from byte representation */
        public static createFromBuffer(buffer: ArrayBuffer): Message {
            let typeCode = new Uint8Array(buffer)[0];

            switch (<MessageType>typeCode) {
                case MessageType.Close:
                    throw new NotImplementedError();
                case MessageType.FieldParams:
                    return new FieldParams(buffer);
                case MessageType.MoveAnswer:
                    return new MoveAnswer(buffer);
                case MessageType.EntitiesInfo:
                    return new EntitiesInfo(buffer);
                case MessageType.ConnectedInfo:
                    return new ConnectedInfo(buffer);
                default:
                    return null;
            }
        }

        /** Serialize message to byte array */
        public abstract toBytes(): void;

        protected setBuffer(buffer: ArrayBuffer, writing?: boolean): void {
            this.buffer = buffer;
            this.bufferView = new Uint8Array(this.buffer);
            this.bufferPos = writing ? 0 : 1;
        }

        protected initBuffer(msgType: MessageType, length: number): void {
            this.setBuffer(new ArrayBuffer(length + 1), true);
            this.appendAsByte(<number>msgType);
        }

        protected appendAsByte(value: number): void {
            this.bufferView[this.bufferPos] = value;
            this.bufferPos++;
        }

        protected appendAsInt32(value: number): void {
            let intView = new Int32Array(1);
            intView[0] = value;
            let byteView = new Uint8Array(intView.buffer);
            for (let i = 0; i < intView.byteLength; i++) {
                this.bufferView[this.bufferPos++] = byteView[i];
            }
        }

        protected getByte(): number {
            return this.bufferView[this.bufferPos++];
        }

        protected getString(length: number): string {
            let stringBytes = new Array(length);
            for (let i = 0; i < length; i++) {
                stringBytes[i] = this.getByte();
            }

            let chars = stringBytes.map(code => String.fromCharCode(code));
            let trimmedString = chars.join('').trim();

            return trimmedString;
        }

        protected getInt32(): number {
            const INT32_SIZE: number = 4;

            let intView = new Int32Array(this.sliceNext(INT32_SIZE));
            return intView[0];
        }

        private sliceNext(length: number): ArrayBuffer {
            let start = this.bufferPos;
            this.bufferPos += length;
            return this.buffer.slice(start, start + length);
        }
    }

    /** Field parameters received */
    class FieldParams extends Message {

        /** Field dimensions */
        public size: number;

        /** Entity initial position */
        public initialPosition: Vector;

        /** List of obstacles */
        public obstacles: Box[];

        /** Never happens */
        public toBytes(): ArrayBuffer {
            throw new NotImplementedError();
        }

        constructor(dataBuffer: ArrayBuffer) {
            super();

            this.setBuffer(dataBuffer);
            this.size = this.getInt32();

            let x = this.getInt32();
            let y = this.getInt32();
            this.initialPosition = new Vector(x, y);

            // All field obstacles
            this.obstacles = new Array<Box>(this.getInt32());
            for (let i = 0; i < this.obstacles.length; i++) {
                let oX = this.getInt32();
                let oY = this.getInt32();
                let oW = this.getInt32();
                let oH = this.getInt32();
                this.obstacles[i] = new Box(oX, oY, oW, oH);
            }
        }
    }

    /** Check whether entity can move or not */
    class CheckMove extends Message {

        /** Get byte representation */
        public toBytes(): ArrayBuffer {
            const DATA_LENGTH = 8;

            this.initBuffer(MessageType.CheckMove, DATA_LENGTH);
            this.appendAsInt32(this.velocity.x);
            this.appendAsInt32(this.velocity.y);

            return this.buffer;
        }

        constructor(public velocity: Vector) {
            super();
        }
    }

    /** Move velocity corrected by server */
    class MoveAnswer extends Message {

        /** Move velocity */
        public velocity: Vector;

        /** Never happens */
        public toBytes(): ArrayBuffer {
            throw new NotImplementedError();
        }

        constructor(dataBuffer: ArrayBuffer) {
            super();

            this.setBuffer(dataBuffer);
            let vX = this.getInt32();
            let vY = this.getInt32();
            this.velocity = new Vector(vX, vY);
        }
    }

    /** All entities' information */
    class EntitiesInfo extends Message {

        /** Entities currently present on the field */
        public entities: Entity[];

        /** Never happens */
        public toBytes(): ArrayBuffer {
            throw new NotImplementedError();
        }

        constructor(dataBuffer: ArrayBuffer) {
            super();

            this.entities = new Array<Entity>();

            this.setBuffer(dataBuffer);
            let entitiesCount = this.getInt32();
            for (let i = 0; i < entitiesCount; i++) {
                let info = new Entity(this.getInt32(), null);
                info.position.x = this.getInt32();
                info.position.y = this.getInt32();
                info.velocity.x = this.getInt32();
                info.velocity.y = this.getInt32();
                this.entities.push(info);
            }
        }
    }

    /** New client (clients) connected */
    class ConnectedInfo extends Message {

        /** New connected clients */
        public newClients: Entity[];

        /** Never happens */
        public toBytes(): ArrayBuffer {
            throw new NotImplementedError();
        }

        constructor(dataBuffer: ArrayBuffer) {
            const NAME_LENGTH: number = 64;

            super();

            this.setBuffer(dataBuffer);
            let nClients = this.getInt32();
            this.newClients = new Array<Entity>(nClients);

            for (let i = 0; i < nClients; i++) {
                let entityId = this.getInt32();
                let entityName = this.getString(NAME_LENGTH);
                this.newClients[i] = new Entity(entityId, entityName);
            }
        }
    }

    /** Internal state */
    class State {

        /** Is state ready */
        public loaded: boolean;

        /** Size of the field */
        public fieldSize: number;

        /** Main entity */
        public player: Entity;

        /** Other entities */
        public others: IIdentMap<Entity>;

        /** Entity size */
        public size: number;

        /** Field obstacles */
        public obstacles: Box[];

        /** Update entity state */
        public update(): void {
            this.player.moveForward();
        }

        constructor(ids: string) {
            let idParts = ids.split('|');
            let id = parseInt(idParts[0]);
            this.player = new Entity(id, idParts[1]);
            this.player.velocity = new Vector(1, 1);
            this.loaded = false;
            this.size = 16;
            this.obstacles = [];
            this.others = {};
        }
    }

    // Communication socket
    var ws: WebSocket = null;

    var state: State = null;

    var view: PageView = null;

    var field: FieldView = null;

    // Connection successful
    function onConnect(): void {
        ws.send(SESSION_START_TOKEN);
        
        view.displayOK();
    }

    // Connection error
    function onConnectionError(): void {
        view.displayError();
    }

    // Continiously update state
    function updateLoop(): void {
        let checkMsg = new CheckMove(state.player.velocity);
        ws.send(checkMsg.toBytes());

        field.render();
    }

    // Process message received from server
    function processMessage(received: Message): void {
        if (received instanceof FieldParams) {
            state.fieldSize = received.size;
            state.player.position = received.initialPosition;
            state.obstacles = received.obstacles;
            field.setState(state);
            setInterval(updateLoop, 30);
        } else if (received instanceof MoveAnswer) {
            state.player.velocity = received.velocity;
            state.update();
        } else if (received instanceof EntitiesInfo) {
            for (let i = 0; i < received.entities.length; i++) {
                let entity = received.entities[i];
                let updatingEntity = state.others[entity.id];
                if (updatingEntity != null) {
                    updatingEntity.position = entity.position;
                    updatingEntity.velocity = entity.velocity;
                }
            }
        } else if (received instanceof ConnectedInfo) {
            for (let entity of received.newClients) {
                if (entity.id == state.player.id)
                    continue;

                state.others[entity.id] = entity;
            }
            state.loaded = true;
            view.refreshClientsList(state);
        } else {
            throw new NotImplementedError();
        }
    }

    // Data message received
    function onDataReceived(e: MessageEvent): void {
        if (state != null) {
            let reader = new FileReader();
            reader.onload = () => {
                let rcvBuffer = <ArrayBuffer>reader.result;
                let receivedMsg = Message.createFromBuffer(rcvBuffer);
                processMessage(receivedMsg);
            };
            reader.readAsArrayBuffer(e.data);
        } else {
            if (typeof (e.data) == "string") {
                state = new State(e.data);
                view.refreshClientsList(state);
            }
        }
    }

    // Start the client
    export function start(): void {
        view = new PageView();

        field = new FieldView($('#field'));
        field.render();

        // Connect to server
        ws = new WebSocket(WS_ENDPOINT);
        ws.onopen = onConnect;
        ws.onmessage = onDataReceived;
        ws.onerror = onConnectionError;
    }
}

$(() => Client.start());