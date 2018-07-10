var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/** Realtime WebSocket test client */
var Client;
(function (Client) {
    var WS_ENDPOINT = "ws://localhost:1234/ws/";
    var SESSION_START_TOKEN = "start";
    /** Tell that functionality is not implemented */
    var NotImplementedError = /** @class */ (function (_super) {
        __extends(NotImplementedError, _super);
        function NotImplementedError() {
            return _super.call(this, "Not implemented!") || this;
        }
        return NotImplementedError;
    }(Error));
    /** Page */
    var PageView = /** @class */ (function () {
        function PageView() {
        }
        PageView.prototype.displayOK = function () {
            $('.state-ok').removeClass('hidden');
        };
        PageView.prototype.displayError = function () {
            $('.state-err').removeClass('hidden');
        };
        /** Update list of connected clients */
        PageView.prototype.refreshClientsList = function (state) {
            var container = $('.main .panel-body');
            container.empty();
            var getEntityLayout = function (entity) {
                return $("<div>").text(entity.name);
            };
            // Player name
            getEntityLayout(state.player).appendTo(container);
            // Other entities
            Object.keys(state.others).forEach(function (entId) {
                var entity = state.others[entId];
                getEntityLayout(entity).appendTo(container);
            });
        };
        return PageView;
    }());
    /** Field on canvas */
    var FieldView = /** @class */ (function () {
        function FieldView(canvas) {
            this.canvas = canvas[0];
            this.ctx = this.canvas.getContext("2d");
        }
        /** Set state data */
        FieldView.prototype.setState = function (state) {
            if (this.state == null) {
                this.state = state;
            }
        };
        // Render message
        FieldView.prototype.renderBanner = function () {
            var MESSAGE = "Waiting...";
            this.ctx.fillStyle = "gray";
            this.ctx.font = "14pt Tahoma";
            var msgWidth = this.ctx.measureText(MESSAGE).width;
            var txtX = (this.canvas.width - msgWidth) / 2;
            var txtY = this.canvas.height / 2 - 10;
            this.ctx.fillText(MESSAGE, txtX, txtY);
        };
        // Get camera position
        FieldView.prototype.getCamera = function () {
            var w = this.canvas.width;
            var h = this.canvas.height;
            var maxCamX = this.state.fieldSize - w;
            var maxCamY = this.state.fieldSize - h;
            var objPos = this.state.player.position;
            var camera = new Box(0, 0, w, h);
            // Horizontal
            if (objPos.x > maxCamX + w / 2) {
                camera.x = maxCamX;
            }
            else if (objPos.x > w / 2) {
                camera.x = objPos.x - w / 2;
            }
            // Vertical
            if (objPos.y > maxCamY + h / 2) {
                camera.y = maxCamY;
            }
            else if (objPos.y > h / 2) {
                camera.y = objPos.y - h / 2;
            }
            return camera;
        };
        // Get all obstacles in given viewport
        FieldView.prototype.getObstaclesInView = function (view) {
            var endX = view.x + view.w;
            var endY = view.y + view.h;
            return this.state.obstacles.filter(function (box) {
                var itemEndX = box.x + box.w;
                if (view.x < itemEndX && endX > box.x) {
                    var itemEndY = box.y + box.h;
                    return view.y < itemEndY && endY > box.y;
                }
                return false;
            });
        };
        // Render one entity
        FieldView.prototype.renderEntity = function (entity, camera) {
            var isMe = entity == this.state.player;
            this.ctx.fillStyle = isMe ? "green" : "blue";
            var pos = entity.position;
            var s = this.state.size;
            var vel = entity.velocity;
            var vX = entity.position.x - camera.x;
            var vY = entity.position.y - camera.y;
            var angle = Math.atan2(vel.y, vel.x);
            var pX = Math.cos(angle) * 20 + vX;
            var pY = Math.sin(angle) * 20 + vY;
            this.ctx.fillRect(vX - s / 2, vY - s / 2, s, s);
            this.ctx.strokeStyle = "black";
            this.ctx.beginPath();
            this.ctx.moveTo(vX, vY);
            this.ctx.lineTo(pX, pY);
            this.ctx.stroke();
        };
        // Render field
        FieldView.prototype.renderField = function () {
            var GRID_STEP = 50;
            var w = this.canvas.width;
            var h = this.canvas.height;
            this.ctx.clearRect(0, 0, w, h);
            var cam = this.getCamera();
            // Gridlines
            this.ctx.strokeStyle = "gray";
            this.ctx.beginPath();
            var nLines = Math.floor(w / GRID_STEP) + 2;
            for (var i = 0; i < nLines; i++) {
                var lX = i * GRID_STEP - (cam.x % GRID_STEP);
                var lY = i * GRID_STEP - (cam.y % GRID_STEP);
                this.ctx.moveTo(lX, 0);
                this.ctx.lineTo(lX, h);
                if (lY < h) {
                    this.ctx.moveTo(0, lY);
                    this.ctx.lineTo(w, lY);
                }
            }
            this.ctx.stroke();
            // Obstacles
            var allBoxesInView = this.getObstaclesInView(cam);
            this.ctx.fillStyle = "#ddddee";
            this.ctx.strokeStyle = "#8888aa";
            for (var _i = 0, allBoxesInView_1 = allBoxesInView; _i < allBoxesInView_1.length; _i++) {
                var box = allBoxesInView_1[_i];
                var boxVX = box.x - cam.x;
                var boxVY = box.y - cam.y;
                this.ctx.fillRect(boxVX, boxVY, box.w, box.h);
                this.ctx.strokeRect(boxVX, boxVY, box.w, box.h);
            }
            // Entities
            this.renderEntity(this.state.player, cam);
            for (var _a = 0, _b = Object.keys(this.state.others); _a < _b.length; _a++) {
                var anotherId = _b[_a];
                var another = this.state.others[anotherId];
                if (cam.contains(another.position)) {
                    this.renderEntity(another, cam);
                }
            }
        };
        /** Render field */
        FieldView.prototype.render = function () {
            if (state != null && state.loaded) {
                this.renderField();
            }
            else {
                this.renderBanner();
            }
        };
        return FieldView;
    }());
    /** Two dimensional vector */
    var Vector = /** @class */ (function () {
        function Vector(x, y) {
            this.x = x;
            this.y = y;
        }
        /** Add vector to vector */
        Vector.prototype.add = function (another) {
            this.x += another.x;
            this.y += another.y;
        };
        return Vector;
    }());
    /** Two dimensional rectangle */
    var Box = /** @class */ (function () {
        function Box(x, y, w, h) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
        }
        /** Deternine if box contains point */
        Box.prototype.contains = function (point) {
            return (point.x >= this.x) && (point.x <= this.x + this.w) &&
                (point.y >= this.y) && (point.y <= this.y + this.h);
        };
        return Box;
    }());
    /** Entity on field */
    var Entity = /** @class */ (function () {
        function Entity(id, name) {
            this.id = id;
            this.name = name;
            this.position = new Vector(-1, -1);
            this.velocity = new Vector(0, 0);
        }
        /** Move entity with current velocity */
        Entity.prototype.moveForward = function () {
            this.position.add(this.velocity);
        };
        return Entity;
    }());
    /** Type of communication message */
    var MessageType;
    (function (MessageType) {
        MessageType[MessageType["Close"] = 0] = "Close";
        MessageType[MessageType["FieldParams"] = 1] = "FieldParams";
        MessageType[MessageType["CheckMove"] = 2] = "CheckMove";
        MessageType[MessageType["MoveAnswer"] = 3] = "MoveAnswer";
        MessageType[MessageType["EntitiesInfo"] = 4] = "EntitiesInfo";
        MessageType[MessageType["ConnectedInfo"] = 5] = "ConnectedInfo";
    })(MessageType || (MessageType = {}));
    /** Base communication message */
    var Message = /** @class */ (function () {
        function Message() {
        }
        /** Create message from byte representation */
        Message.createFromBuffer = function (buffer) {
            var typeCode = new Uint8Array(buffer)[0];
            switch (typeCode) {
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
        };
        Message.prototype.setBuffer = function (buffer, writing) {
            this.buffer = buffer;
            this.bufferView = new Uint8Array(this.buffer);
            this.bufferPos = writing ? 0 : 1;
        };
        Message.prototype.initBuffer = function (msgType, length) {
            this.setBuffer(new ArrayBuffer(length + 1), true);
            this.appendAsByte(msgType);
        };
        Message.prototype.appendAsByte = function (value) {
            this.bufferView[this.bufferPos] = value;
            this.bufferPos++;
        };
        Message.prototype.appendAsInt32 = function (value) {
            var intView = new Int32Array(1);
            intView[0] = value;
            var byteView = new Uint8Array(intView.buffer);
            for (var i = 0; i < intView.byteLength; i++) {
                this.bufferView[this.bufferPos++] = byteView[i];
            }
        };
        Message.prototype.getByte = function () {
            return this.bufferView[this.bufferPos++];
        };
        Message.prototype.getString = function (length) {
            var stringBytes = new Array(length);
            for (var i = 0; i < length; i++) {
                stringBytes[i] = this.getByte();
            }
            var chars = stringBytes.map(function (code) { return String.fromCharCode(code); });
            var trimmedString = chars.join('').trim();
            return trimmedString;
        };
        Message.prototype.getInt32 = function () {
            var INT32_SIZE = 4;
            var intView = new Int32Array(this.sliceNext(INT32_SIZE));
            return intView[0];
        };
        Message.prototype.sliceNext = function (length) {
            var start = this.bufferPos;
            this.bufferPos += length;
            return this.buffer.slice(start, start + length);
        };
        return Message;
    }());
    /** Field parameters received */
    var FieldParams = /** @class */ (function (_super) {
        __extends(FieldParams, _super);
        function FieldParams(dataBuffer) {
            var _this = _super.call(this) || this;
            _this.setBuffer(dataBuffer);
            _this.size = _this.getInt32();
            var x = _this.getInt32();
            var y = _this.getInt32();
            _this.initialPosition = new Vector(x, y);
            // All field obstacles
            _this.obstacles = new Array(_this.getInt32());
            for (var i = 0; i < _this.obstacles.length; i++) {
                var oX = _this.getInt32();
                var oY = _this.getInt32();
                var oW = _this.getInt32();
                var oH = _this.getInt32();
                _this.obstacles[i] = new Box(oX, oY, oW, oH);
            }
            return _this;
        }
        /** Never happens */
        FieldParams.prototype.toBytes = function () {
            throw new NotImplementedError();
        };
        return FieldParams;
    }(Message));
    /** Check whether entity can move or not */
    var CheckMove = /** @class */ (function (_super) {
        __extends(CheckMove, _super);
        function CheckMove(velocity) {
            var _this = _super.call(this) || this;
            _this.velocity = velocity;
            return _this;
        }
        /** Get byte representation */
        CheckMove.prototype.toBytes = function () {
            var DATA_LENGTH = 8;
            this.initBuffer(MessageType.CheckMove, DATA_LENGTH);
            this.appendAsInt32(this.velocity.x);
            this.appendAsInt32(this.velocity.y);
            return this.buffer;
        };
        return CheckMove;
    }(Message));
    /** Move velocity corrected by server */
    var MoveAnswer = /** @class */ (function (_super) {
        __extends(MoveAnswer, _super);
        function MoveAnswer(dataBuffer) {
            var _this = _super.call(this) || this;
            _this.setBuffer(dataBuffer);
            var vX = _this.getInt32();
            var vY = _this.getInt32();
            _this.velocity = new Vector(vX, vY);
            return _this;
        }
        /** Never happens */
        MoveAnswer.prototype.toBytes = function () {
            throw new NotImplementedError();
        };
        return MoveAnswer;
    }(Message));
    /** All entities' information */
    var EntitiesInfo = /** @class */ (function (_super) {
        __extends(EntitiesInfo, _super);
        function EntitiesInfo(dataBuffer) {
            var _this = _super.call(this) || this;
            _this.entities = new Array();
            _this.setBuffer(dataBuffer);
            var entitiesCount = _this.getInt32();
            for (var i = 0; i < entitiesCount; i++) {
                var info = new Entity(_this.getInt32(), null);
                info.position.x = _this.getInt32();
                info.position.y = _this.getInt32();
                info.velocity.x = _this.getInt32();
                info.velocity.y = _this.getInt32();
                _this.entities.push(info);
            }
            return _this;
        }
        /** Never happens */
        EntitiesInfo.prototype.toBytes = function () {
            throw new NotImplementedError();
        };
        return EntitiesInfo;
    }(Message));
    /** New client (clients) connected */
    var ConnectedInfo = /** @class */ (function (_super) {
        __extends(ConnectedInfo, _super);
        function ConnectedInfo(dataBuffer) {
            var _this = this;
            var NAME_LENGTH = 64;
            _this = _super.call(this) || this;
            _this.setBuffer(dataBuffer);
            var nClients = _this.getInt32();
            _this.newClients = new Array(nClients);
            for (var i = 0; i < nClients; i++) {
                var entityId = _this.getInt32();
                var entityName = _this.getString(NAME_LENGTH);
                _this.newClients[i] = new Entity(entityId, entityName);
            }
            return _this;
        }
        /** Never happens */
        ConnectedInfo.prototype.toBytes = function () {
            throw new NotImplementedError();
        };
        return ConnectedInfo;
    }(Message));
    /** Internal state */
    var State = /** @class */ (function () {
        function State(ids) {
            var idParts = ids.split('|');
            var id = parseInt(idParts[0]);
            this.player = new Entity(id, idParts[1]);
            this.player.velocity = new Vector(1, 1);
            this.loaded = false;
            this.size = 16;
            this.obstacles = [];
            this.others = {};
        }
        /** Update entity state */
        State.prototype.update = function () {
            this.player.moveForward();
        };
        return State;
    }());
    // Communication socket
    var ws = null;
    var state = null;
    var view = null;
    var field = null;
    // Connection successful
    function onConnect() {
        ws.send(SESSION_START_TOKEN);
        view.displayOK();
    }
    // Connection error
    function onConnectionError() {
        view.displayError();
    }
    // Continiously update state
    function updateLoop() {
        var checkMsg = new CheckMove(state.player.velocity);
        ws.send(checkMsg.toBytes());
        field.render();
    }
    // Process message received from server
    function processMessage(received) {
        if (received instanceof FieldParams) {
            state.fieldSize = received.size;
            state.player.position = received.initialPosition;
            state.obstacles = received.obstacles;
            field.setState(state);
            setInterval(updateLoop, 30);
        }
        else if (received instanceof MoveAnswer) {
            state.player.velocity = received.velocity;
            state.update();
        }
        else if (received instanceof EntitiesInfo) {
            for (var i = 0; i < received.entities.length; i++) {
                var entity = received.entities[i];
                var updatingEntity = state.others[entity.id];
                if (updatingEntity != null) {
                    updatingEntity.position = entity.position;
                    updatingEntity.velocity = entity.velocity;
                }
            }
        }
        else if (received instanceof ConnectedInfo) {
            for (var _i = 0, _a = received.newClients; _i < _a.length; _i++) {
                var entity = _a[_i];
                if (entity.id == state.player.id)
                    continue;
                state.others[entity.id] = entity;
            }
            state.loaded = true;
            view.refreshClientsList(state);
        }
        else {
            throw new NotImplementedError();
        }
    }
    // Data message received
    function onDataReceived(e) {
        if (state != null) {
            var reader_1 = new FileReader();
            reader_1.onload = function () {
                var receivedMsg = Message.createFromBuffer(reader_1.result);
                processMessage(receivedMsg);
            };
            reader_1.readAsArrayBuffer(e.data);
        }
        else {
            if (typeof (e.data) == "string") {
                state = new State(e.data);
                view.refreshClientsList(state);
            }
        }
    }
    // Start the client
    function start() {
        view = new PageView();
        field = new FieldView($('#field'));
        field.render();
        // Connect to server
        ws = new WebSocket(WS_ENDPOINT);
        ws.onopen = onConnect;
        ws.onmessage = onDataReceived;
        ws.onerror = onConnectionError;
    }
    Client.start = start;
})(Client || (Client = {}));
$(function () { return Client.start(); });
//# sourceMappingURL=client.js.map