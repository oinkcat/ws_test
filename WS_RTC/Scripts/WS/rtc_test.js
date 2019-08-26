var RTCTest;
(function (RTCTest) {
    // Signalling server messages
    var MSG_INIT = "init";
    var MSG_CLIENTS = "ready_clients";
    var MSG_OFFER = "offer";
    var MSG_ANSWER = "answer";
    var MSG_ICE = "ice";
    var MSG_DISCONNECTED = "disconnected";
    /** P2P audio connection */
    var RTCAudioConnection = /** @class */ (function () {
        function RTCAudioConnection(remoteId, myStream) {
            var _this = this;
            this.remoteId = remoteId;
            // Peer offer options
            this.offerOption = {
                offerToReceiveAudio: true
            };
            // WebRTC configuration
            this.rtcConfig = {
                iceServers: [{
                        urls: "turn:176.122.22.34",
                        username: "testuser",
                        credential: "testpass"
                    }]
            };
            // Create connection
            this.connection = new RTCPeerConnection(this.rtcConfig);
            var iceHandler = this.onICECandidate.bind(this);
            this.connection.onicecandidate = iceHandler;
            var stateHandler = this.onStateChange.bind(this);
            this.connection.oniceconnectionstatechange = stateHandler;
            this.connection.onsignalingstatechange = stateHandler;
            this.connection.onconnectionstatechange = stateHandler;
            var trackHandler = this.onRemoteTrack.bind(this);
            this.connection.addEventListener("track", trackHandler);
            this.connection.addEventListener("addstream", trackHandler);
            // Add audio stream
            var addStreamFunc = this.connection.addStream;
            if (addStreamFunc != null) {
                addStreamFunc.call(this.connection, myStream);
            }
            else {
                myStream.getTracks().forEach(function (t) {
                    _this.connection.addTrack(t, myStream);
                });
            }
        }
        Object.defineProperty(RTCAudioConnection.prototype, "debugId", {
            get: function () {
                return "*" + this.remoteId.substr(23);
            },
            enumerable: true,
            configurable: true
        });
        /** Send offer to remote party */
        RTCAudioConnection.prototype.sendOffer = function () {
            var _this = this;
            var baseMsg = "RTC, " + this.debugId + ":";
            this.connection.createOffer(this.offerOption)
                .then(function (sdp) {
                // Local descriptor created
                logMessage(baseMsg + " Offer created");
                _this.connection.setLocalDescription(sdp);
                // Send offer message
                var offerMsg = {
                    type: MSG_OFFER,
                    data: sdp,
                    target: _this.remoteId
                };
                sendMessage(offerMsg);
            })
                .catch(function () {
                var msg = baseMsg + " Failed to create offer!";
                return logMessage(msg);
            });
        };
        /**
         * Set received answer
         * @param answerData Answer SDP
         */
        RTCAudioConnection.prototype.setRemoteAnswer = function (answerData) {
            var remoteSdp = new RTCSessionDescription(answerData);
            var baseMsg = "RTC, " + this.debugId + ": Remote description";
            this.connection.setRemoteDescription(remoteSdp)
                .then(function () { return logMessage(baseMsg + " set!"); })
                .catch(function () { return logMessage(baseMsg + " set error!"); });
        };
        /**
         * Set new ICE candidate data
         * @param iceData ICE data
         */
        RTCAudioConnection.prototype.setNewICECandidate = function (iceData) {
            this.connection.addIceCandidate(new RTCIceCandidate(iceData));
        };
        /**
         * Set remote offer data and send answer
         * @param offerData Remote offer
         */
        RTCAudioConnection.prototype.setRemoteOffer = function (offerData) {
            var _this = this;
            var remoteDesc = new RTCSessionDescription(offerData);
            var baseMsg1 = "RTC, " + this.debugId + ": Remote description";
            // Set remote description
            this.connection.setRemoteDescription(remoteDesc)
                .then(function () { return logMessage(baseMsg1 + " set!"); })
                .catch(function (e) { return logMessage(baseMsg1 + " error: " + e); });
            var baseMsg2 = "RTC, " + this.debugId + ": Answer";
            // Create answer
            this.connection.createAnswer(this.offerOption)
                .then(function (answerSdp) {
                // Answer sdp created
                logMessage(baseMsg2 + " created!");
                _this.connection.setLocalDescription(answerSdp);
                var answerMessage = {
                    type: MSG_ANSWER,
                    data: answerSdp,
                    target: _this.remoteId
                };
                sendMessage(answerMessage);
            })
                .catch(function (e) { return logMessage(baseMsg2 + " error: " + e); });
        };
        /** Remove resources associated with client */
        RTCAudioConnection.prototype.dispose = function () {
            this.connection.close();
            $("#" + this.remoteId).parents(".peer-audio").remove();
        };
        /** Connection state changed */
        RTCAudioConnection.prototype.onStateChange = function (e) {
            var connState = this.connection.connectionState;
            var signState = this.connection.signalingState;
            var iceState = this.connection.iceConnectionState;
            var states = "C: " + connState + ", S: " + signState + ", I: " + iceState;
            logMessage("RTC, " + this.debugId + ": States: " + states);
        };
        /** Got remote track */
        RTCAudioConnection.prototype.onRemoteTrack = function (e) {
            if (e.stream) {
                var peerAudio = $("<audio controls>").attr("id", this.remoteId);
                var jControlBlock = $("<div class=peer-audio>")
                    .append($("<h4>").text(this.remoteId))
                    .append(peerAudio);
                $("#audioControls").append(jControlBlock);
                this.remoteAudioElem = peerAudio.get(0);
                this.remoteAudioElem.srcObject = e.stream;
                this.remoteAudioElem.play();
                logMessage("RTC, " + this.debugId + ": Got remote track");
            }
        };
        /** On ICE candidate */
        RTCAudioConnection.prototype.onICECandidate = function (e) {
            var iceMsg = {
                type: MSG_ICE,
                data: e.candidate,
                target: this.remoteId
            };
            sendMessage(iceMsg);
        };
        return RTCAudioConnection;
    }());
    var socket;
    var labels; // JQuery
    // Local audio output
    var myAudioElem;
    // Local audio stream
    var localStream;
    // All connected pairs
    var connectionPairs;
    /**
     * Add log message
     * @param text Message text
     */
    function logMessage(text) {
        var msgElem = $("<div>").text(text);
        $("#messages").append(msgElem);
    }
    /**
     * Get pair by remote client's id
     * @param remoteId Remote client identifier
     */
    function getPairById(remoteId) {
        var found = connectionPairs.filter(function (p) { return p.remoteId == remoteId; });
        return found.length > 0 ? found[0] : null;
    }
    /**
     * Create connections with remote clients
     * @param remoteIds Remote clients' id
     */
    function createConnectionPairs(remoteIds) {
        for (var _i = 0, remoteIds_1 = remoteIds; _i < remoteIds_1.length; _i++) {
            var id = remoteIds_1[_i];
            var newConnection = new RTCAudioConnection(id, localStream);
            newConnection.sendOffer();
            connectionPairs.push(newConnection);
            logMessage("Me -> " + id + ". Conn. no: " + connectionPairs.length);
        }
    }
    /**
     * Show client's id on page
     * @param id Local id
     */
    function showLocalId(id) {
        $(".my-audio h4").append("<br/>" + id);
    }
    /**
     * Got answer to sent offer
     * @param remoteId Remote peer's id
     * @param answer Answer SDP
     */
    function gotRemoteAnswer(remoteId, answer) {
        var pair = getPairById(remoteId);
        pair.setRemoteAnswer(answer);
    }
    /**
     * Got ICE candidate data
     * @param remoteId Remote peer's id
     * @param iceData New ICE candidate
     */
    function gotICECandidate(remoteId, iceData) {
        var pair = getPairById(remoteId);
        if (pair != null) {
            pair.setNewICECandidate(iceData);
        }
    }
    /**
     * Received connection offer
     * @param remoteId Remote peer's id
     * @param offerData Connection offer
     */
    function getOfferFromPeer(remoteId, offerData) {
        var newConnection = new RTCAudioConnection(remoteId, localStream);
        newConnection.setRemoteOffer(offerData);
        connectionPairs.push(newConnection);
        logMessage(remoteId + " -> Me. Conn. no: " + connectionPairs.length);
    }
    /**
     * Remove disconnected client's resources
     * @param remoteId Remote peer's id
     */
    function disposeClient(remoteId) {
        var pairToRemove = getPairById(remoteId);
        if (pairToRemove != null) {
            pairToRemove.dispose();
            connectionPairs.splice(connectionPairs.indexOf(pairToRemove), 1);
            logMessage("WS: " + pairToRemove.remoteId + " disconnected");
        }
    }
    /**
     * Process signalling server message
     * @param msg Message from server
     */
    function processMessage(msg) {
        var type = msg["Type"];
        var payload = msg["Data"];
        var remoteId = msg["Target"];
        if (type == MSG_CLIENTS) {
            var readyIds = payload;
            if (readyIds.length > 0) {
                createConnectionPairs(readyIds);
                showLocalId(remoteId);
            }
        }
        else if (type == MSG_OFFER) {
            getOfferFromPeer(remoteId, payload);
        }
        else if (type == MSG_ANSWER) {
            gotRemoteAnswer(remoteId, payload);
        }
        else if (type == MSG_ICE) {
            gotICECandidate(remoteId, payload);
        }
        else if (type == MSG_DISCONNECTED) {
            disposeClient(remoteId);
        }
    }
    /**
     * Send message to signalling server
     * @param msg Message to send
     */
    function sendMessage(msg) {
        socket.send(JSON.stringify(msg));
    }
    /**
     * Got local audio stream
     * @param audioStream Local audio stream
     */
    function gotLocalStream(audioStream) {
        localStream = audioStream;
        // Listen local stream
        myAudioElem.srcObject = localStream;
        myAudioElem.volume = 0.1;
        myAudioElem.play();
        // Show volume control
        $(myAudioElem).parents(".my-audio").removeClass("hidden");
        // Send ready message
        var initMsg = {
            type: MSG_INIT,
            data: null
        };
        sendMessage(initMsg);
    }
    /** Request client audio stream */
    function requestMediaStream() {
        navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 12000 },
            video: false
        }).then(gotLocalStream)
            .catch(function () { return logMessage("RTC: Cannot access microphone!"); });
    }
    /** On connection */
    function socketConnected() {
        logMessage("WS: Connected to server!");
        labels.eq(0).removeClass("hidden");
        setTimeout(requestMediaStream, 1000);
    }
    /** On network error */
    function socketError() {
        logMessage("WS: Connection error!");
        labels.eq(1).removeClass("hidden");
    }
    //** On receive data from server */
    function socketMessage(e) {
        var msg = JSON.parse(e.data);
        processMessage(msg);
    }
    /** Connect audio processing server */
    function connectSignallingServer() {
        var serverAddress = $("#wsAddress").val();
        socket = new WebSocket(serverAddress);
        socket.onopen = socketConnected;
        // Socket closing is also exception there
        socket.onerror = socket.onclose = socketError;
        socket.onmessage = socketMessage;
    }
    /** Initialize page UI */
    function initializeUi() {
        labels = $("h2 .label");
        myAudioElem = $("#myAudio")[0];
    }
    /** Initialize RTC peer */
    function initialize() {
        connectionPairs = [];
        initializeUi();
        connectSignallingServer();
    }
    RTCTest.initialize = initialize;
})(RTCTest || (RTCTest = {}));
$(function () { return RTCTest.initialize(); });
//# sourceMappingURL=rtc_test.js.map