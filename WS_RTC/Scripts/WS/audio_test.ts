// Audio transfer test
declare var $: JQueryStatic;

module AudioTest {

    // Audio server connect URL
    const AUDIO_ENDPOINT: string = "ws://localhost:5678/wsaudio/";

    const SAMPLE_SIZE: number = 4096;

    var inAudioElem: HTMLAudioElement;

    var inputAudio: AudioContext;
    var outputAudio: AudioContext;
    var playBuffers: Array<AudioBuffer> = [];

    var socket: WebSocket;

    var time: number = 0;

    var labels: any;

    // Prepare audio processor
    function trackStarted() {
        inputAudio = new AudioContext();
        let elemSrc = inputAudio.createMediaElementSource(inAudioElem);
        let processor = inputAudio.createScriptProcessor(SAMPLE_SIZE, 1, 1);
        elemSrc.connect(processor);

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
            let buffer = e.inputBuffer.getChannelData(0);
            socket.send(buffer);
        };
    }

    // Prepare microphone for capturing
    function initializeMicrophone() {
        inputAudio = new AudioContext();
        let request = {
            audio: {
                sampleRate: 16000
            },
            video: false
        };
        (<any>navigator).mozGetUserMedia(request, stream => {
            let elemSrc = (<any>inputAudio).createMediaStreamSource(stream);
            let processor = inputAudio.createScriptProcessor(SAMPLE_SIZE, 1, 1);
            elemSrc.connect(processor);

            processor.onaudioprocess = (e: AudioProcessingEvent) => {
                let buffer = e.inputBuffer.getChannelData(0);
                socket.send(buffer);
            };
        }, () => console.log("Cannot access microphone!"));
    }

    // Received sample from server
    function sampleReceived(buffer: ArrayBuffer) {
        let receivedData = new Float32Array(buffer);
        let rcvSize = receivedData.length;
        let inpSR = inputAudio.sampleRate;
        let sampleBuffer = outputAudio.createBuffer(1, rcvSize, inpSR);
        let channelData = sampleBuffer.getChannelData(0);

        for (let i = 0; i < channelData.length; i++) {
            channelData[i] = receivedData[i];
        }

        let outputSource = outputAudio.createBufferSource();
        outputSource.buffer = sampleBuffer;
        outputSource.connect(outputAudio.destination);

        outputSource.start();
    }

    function socketConnected() {
        console.log("Connected to server!");
        labels.eq(0).removeClass("hidden");
    }

    function socketError() {
        console.log("Connection error!");
        labels.eq(1).removeClass("hidden");
    }

    // On receive data from server
    function socketMessage(e: MessageEvent) {
        let reader = new FileReader();
        reader.onload = () => sampleReceived(<ArrayBuffer>reader.result);

        reader.readAsArrayBuffer(e.data);
    }

    // Connect audio processing server
    function connectAudioServer() {
        socket = new WebSocket(AUDIO_ENDPOINT);

        socket.onopen = socketConnected;
        socket.onerror = socketError;
        socket.onmessage = socketMessage;
    }

    // Initialize audio buffer for remote data
    function initializeRemoteAudio() {
        outputAudio = new AudioContext();
    }

    // Initialize page UI
    function initializeUi() {
        labels = $("h2 .label");

        $("#chooseSource button").click(e => {
            let btnIdx = $(e.target).index();
            let sources = $(".src");
            sources.eq(btnIdx).removeClass("hidden");

            if (btnIdx == 1) {
                initializeMicrophone();
            }

            $("#chooseSource").addClass("hidden");
        });
    }

    // Initialize
    export function initialize() {
        inAudioElem = <HTMLAudioElement>$("#testAudio").get(0);
        inAudioElem.onplay = trackStarted;

        initializeUi();
        initializeRemoteAudio();
        connectAudioServer();
    }
}

$(() => AudioTest.initialize());