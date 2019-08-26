// WebRTC test
declare var $: JQueryStatic;

module RTCTest {

    // Signalling server messages
    const MSG_INIT: string = "init";
    const MSG_CLIENTS: string = "ready_clients";
    const MSG_OFFER: string = "offer";
    const MSG_ANSWER: string = "answer";
    const MSG_ICE: string = "ice";
    const MSG_DISCONNECTED: string = "disconnected";
    
    /** P2P audio connection */
    class RTCAudioConnection {

        // Peer offer options
        private offerOption: RTCOfferOptions = {
            offerToReceiveAudio: true
        };

        // WebRTC configuration
        private rtcConfig: RTCConfiguration = {
            iceServers: [{
                urls: "turn:176.122.22.34",
                username: "testuser",
                credential: "testpass"
            }]
        };

        // P2P connection
        private connection: RTCPeerConnection;

        // Remote peer audio output
        private remoteAudioElem: HTMLAudioElement;

        private get debugId() {
            return `*${this.remoteId.substr(23)}`;
        }

        /** Send offer to remote party */
        public sendOffer(): void {
            const baseMsg = `RTC, ${this.debugId}:`;

            this.connection.createOffer(this.offerOption)
                .then((sdp: RTCSessionDescription) => {
                    // Local descriptor created
                    logMessage(`${baseMsg} Offer created`);
                    this.connection.setLocalDescription(sdp);

                    // Send offer message
                    let offerMsg = {
                        type: MSG_OFFER,
                        data: sdp,
                        target: this.remoteId
                    };
                    sendMessage(offerMsg);
                })
                .catch(() => {
                    let msg = `${baseMsg} Failed to create offer!`;
                    return logMessage(msg);
                });
        }

        /**
         * Set received answer
         * @param answerData Answer SDP
         */
        public setRemoteAnswer(answerData: any): void {
            let remoteSdp = new RTCSessionDescription(answerData);
            const baseMsg = `RTC, ${this.debugId}: Remote description`;

            this.connection.setRemoteDescription(remoteSdp)
                .then(() => logMessage(`${baseMsg} set!`))
                .catch(() => logMessage(`${baseMsg} set error!`));
        }

        /**
         * Set new ICE candidate data
         * @param iceData ICE data
         */
        public setNewICECandidate(iceData: any): void {
            this.connection.addIceCandidate(new RTCIceCandidate(iceData));
        }

        /**
         * Set remote offer data and send answer
         * @param offerData Remote offer
         */
        public setRemoteOffer(offerData: any): void {
            let remoteDesc = new RTCSessionDescription(offerData);
            const baseMsg1 = `RTC, ${this.debugId}: Remote description`;

            // Set remote description
            this.connection.setRemoteDescription(remoteDesc)
                .then(() => logMessage(`${baseMsg1} set!`))
                .catch(e => logMessage(`${baseMsg1} error: ${e}`));

            const baseMsg2 = `RTC, ${this.debugId}: Answer`;

            // Create answer
            this.connection.createAnswer(this.offerOption)
                .then(answerSdp => {
                    // Answer sdp created
                    logMessage(`${baseMsg2} created!`);
                    this.connection.setLocalDescription(answerSdp);

                    let answerMessage = {
                        type: MSG_ANSWER,
                        data: answerSdp,
                        target: this.remoteId
                    };
                    sendMessage(answerMessage);
                })
                .catch(e => logMessage(`${baseMsg2} error: ${e}`));
        }

        /** Remove resources associated with client */
        public dispose(): void {
            this.connection.close();
            $(`#${this.remoteId}`).parents(".peer-audio").remove();
        }

        /** Connection state changed */
        private onStateChange(e: Event): void {
            const connState = this.connection.connectionState;
            const signState = this.connection.signalingState;
            const iceState = this.connection.iceConnectionState;

            const states = `C: ${connState}, S: ${signState}, I: ${iceState}`;

            logMessage(`RTC, ${this.debugId}: States: ${states}`);
        }

        /** Got remote track */
        private onRemoteTrack(e: any): void {
            if (e.stream) {
                const peerAudio = $("<audio controls>").attr("id", this.remoteId);
                const jControlBlock = $("<div class=peer-audio>")
                    .append($("<h4>").text(this.remoteId))
                    .append(peerAudio);
                $("#audioControls").append(jControlBlock);

                this.remoteAudioElem = <HTMLAudioElement>peerAudio.get(0);
                this.remoteAudioElem.srcObject = e.stream;

                this.remoteAudioElem.play();

                logMessage(`RTC, ${this.debugId}: Got remote track`);
            }
        }

        /** On ICE candidate */
        private onICECandidate(e: RTCPeerConnectionIceEvent): void {
            let iceMsg = {
                type: MSG_ICE,
                data: e.candidate,
                target: this.remoteId
            };
            sendMessage(iceMsg);
        }

        constructor(public remoteId: string, myStream: MediaStream) {
            // Create connection
            this.connection = new RTCPeerConnection(this.rtcConfig);

            let iceHandler = this.onICECandidate.bind(this);
            this.connection.onicecandidate = iceHandler;

            let stateHandler = this.onStateChange.bind(this);
            this.connection.oniceconnectionstatechange = stateHandler;
            this.connection.onsignalingstatechange = stateHandler;
            this.connection.onconnectionstatechange = stateHandler;

            let trackHandler = this.onRemoteTrack.bind(this);
            this.connection.addEventListener("track", trackHandler);
            this.connection.addEventListener("addstream", trackHandler);

            // Add audio stream
            let addStreamFunc = (<any>this.connection).addStream;

            if (addStreamFunc != null) {
                addStreamFunc.call(this.connection, myStream);
            } else {
                myStream.getTracks().forEach(t => {
                    this.connection.addTrack(t, myStream)
                });
            }
        }
    }

    var socket: WebSocket;

    var labels: any; // JQuery

    // Local audio output
    var myAudioElem: HTMLAudioElement;

    // Local audio stream
    var localStream: MediaStream;

    // All connected pairs
    var connectionPairs: Array<RTCAudioConnection>;

    /**
     * Add log message
     * @param text Message text
     */
    function logMessage(text: string): void {
        let msgElem = $("<div>").text(text);
        $("#messages").append(msgElem);
    }

    /**
     * Get pair by remote client's id
     * @param remoteId Remote client identifier
     */
    function getPairById(remoteId: string): RTCAudioConnection {
        let found = connectionPairs.filter(p => p.remoteId == remoteId);
        return found.length > 0 ? found[0] : null;
    }

    /**
     * Create connections with remote clients
     * @param remoteIds Remote clients' id
     */
    function createConnectionPairs(remoteIds: string[]): void {
        for (let id of remoteIds) {
            let newConnection = new RTCAudioConnection(id, localStream);
            newConnection.sendOffer();
            connectionPairs.push(newConnection);

            logMessage(`Me -> ${id}. Conn. no: ${connectionPairs.length}`);
        }
    }

    /**
     * Show client's id on page
     * @param id Local id
     */
    function showLocalId(id: string): void {
        $(".my-audio h4").append(`<br/>${id}`)
    }

    /**
     * Got answer to sent offer
     * @param remoteId Remote peer's id
     * @param answer Answer SDP
     */
    function gotRemoteAnswer(remoteId: string, answer: any): void {
        let pair = getPairById(remoteId);
        pair.setRemoteAnswer(answer);
    }

    /**
     * Got ICE candidate data
     * @param remoteId Remote peer's id
     * @param iceData New ICE candidate
     */
    function gotICECandidate(remoteId: string, iceData: any): void {
        let pair = getPairById(remoteId);
        if (pair != null) {
            pair.setNewICECandidate(iceData);
        }
    }

    /**
     * Received connection offer
     * @param remoteId Remote peer's id
     * @param offerData Connection offer
     */
    function getOfferFromPeer(remoteId: string, offerData: any): void {
        var newConnection = new RTCAudioConnection(remoteId, localStream);
        newConnection.setRemoteOffer(offerData);
        connectionPairs.push(newConnection);

        logMessage(`${remoteId} -> Me. Conn. no: ${connectionPairs.length}`);
    }

    /**
     * Remove disconnected client's resources
     * @param remoteId Remote peer's id
     */
    function disposeClient(remoteId: string): void {
        const pairToRemove = getPairById(remoteId);

        if (pairToRemove != null) {
            pairToRemove.dispose();
            connectionPairs.splice(connectionPairs.indexOf(pairToRemove), 1);

            logMessage(`WS: ${pairToRemove.remoteId} disconnected`);
        }
    }

    /**
     * Process signalling server message
     * @param msg Message from server
     */
    function processMessage(msg: any): void {
        let type: string = msg["Type"];
        let payload = msg["Data"];
        let remoteId = msg["Target"];

        if (type == MSG_CLIENTS) {
            let readyIds = <string[]>payload;
            if (readyIds.length > 0) {
                createConnectionPairs(readyIds);
                showLocalId(remoteId);
            }
        } else if (type == MSG_OFFER) {
            getOfferFromPeer(remoteId, payload);
        } else if (type == MSG_ANSWER) {
            gotRemoteAnswer(remoteId, payload);
        } else if (type == MSG_ICE) {
            gotICECandidate(remoteId, payload);
        } else if (type == MSG_DISCONNECTED) {
            disposeClient(remoteId);
        }
    }

    /**
     * Send message to signalling server
     * @param msg Message to send
     */
    function sendMessage(msg: any): void {
        socket.send(JSON.stringify(msg));
    }

    /**
     * Got local audio stream
     * @param audioStream Local audio stream
     */
    function gotLocalStream(audioStream: MediaStream) {
        localStream = audioStream;
        // Listen local stream
        myAudioElem.srcObject = localStream;
        myAudioElem.volume = 0.1;
        myAudioElem.play();

        // Show volume control
        $(myAudioElem).parents(".my-audio").removeClass("hidden");

        // Send ready message
        let initMsg = {
            type: MSG_INIT,
            data: null
        };
        sendMessage(initMsg);
    }

    /** Request client audio stream */
    function requestMediaStream(): void {
        navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 12000 },
            video: false
        }).then(gotLocalStream)
          .catch(() => logMessage("RTC: Cannot access microphone!"));
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
    function socketMessage(e: MessageEvent) {
        var msg = JSON.parse(e.data);
        processMessage(msg);
    }

    /** Connect audio processing server */
    function connectSignallingServer() {
        const serverAddress = $("#wsAddress").val();
        socket = new WebSocket(serverAddress);

        socket.onopen = socketConnected;
        // Socket closing is also exception there
        socket.onerror = socket.onclose = socketError;
        socket.onmessage = socketMessage;
    }

    /** Initialize page UI */
    function initializeUi() {
        labels = $("h2 .label");
        myAudioElem = <HTMLAudioElement>$("#myAudio")[0];
    }

    /** Initialize RTC peer */
    export function initialize() {
        connectionPairs = [];
        initializeUi();
        connectSignallingServer();
    }
}

$(() => RTCTest.initialize());