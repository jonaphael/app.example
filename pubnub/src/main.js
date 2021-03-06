import React from 'react';
import ReactDOM from 'react-dom';
import PubNub from 'pubnub';
import * as R from 'ramda';


const config = {
    publishKey: 'set the pubnub publish key',
    subscribeKey: 'set the pubnub subscribe key',
    channelUp: 'Channel for messages from network server',
    channelDown: 'Channel for messages to network server',

    // Is used only to send `downlink_claim` message to server
    // Set device of class "C"
    network: 'network-id',
    device: 'set the dev eui'
}


class Bus {
	constructor(pubNubConfig, addLog, onMessage){
		this.client = new PubNub({
			publishKey : pubNubConfig.publishKey,
			subscribeKey : pubNubConfig.subscribeKey     
		});
		
		this.channelDown = pubNubConfig.channelDown;
		this.channelUp = pubNubConfig.channelUp;
		this.addLog = addLog;
		
		// Add Listener
		this.client.addListener({
			status: (s) => this.status(s),
			message: (msg) => onMessage(msg.message)
		}); 

		this.client.subscribe({channels: [this.channelUp]});
 	}
  
	status(statusEvent){
		if (statusEvent.category === "PNConnectedCategory") {
			this.addLog('Connected to PubNub server');
		} 
	}
  
	send(message, cb){
		this.client.publish({channel: this.channelDown,
			  			     message: message}, 
						    cb);
	}
}


class ApplicationServer {
    constructor (state, addPacket, addLog) {
        this.state = state;
        this.addPacket = addPacket;
        this.addLog = addLog;
  		this.bus = new Bus(this.state.props.pubNub, this.addLog,
                           (p) => this.handlePacket(p));
    }

	hexToBase64(hexstr) {
	  if (hexstr.length == 0) 
		return "";
	  return btoa(hexstr.match(/\w{2}/g).map(hex => String.fromCharCode(parseInt(hex, 16))).join(""));
	}

	handlePacket(packet){
        this.addPacket(packet);
        switch (packet.type) {
            case 'downlink_request':
                this.handleDownlinkRequest(packet);
                break;
            case 'uplink':
                console.log('Add the uplink handler here.');
                break;
            case 'downlink':
                console.log('Add the downlink handler here.');
                break;
            case 'join_request':
                console.log('Add the join_request handler here.');
                break;
            case 'error':
                console.log('Add the error handler here.');
                break;
            case 'warning':
                console.log('Add the warning handler here.');
                break;
            case 'info':
                console.log('Add the info handler here.');
                break;
        }
	}

	handleDownlinkRequest(packet){
        this.addLog('Received downlink_request, prepare downlink_response');

        const downlink_response = {meta: packet.meta,
                                   type: 'downlink_response',
                                   params: {port: this.state.form.port,
                                            payload: this.hexToBase64(this.state.form.payload),
                                            counter_down: packet.params.counter_down}};

        this.bus.send(downlink_response,
                      () => this.addLog('The downlink_response successful published'));
	}

    sendDownlinkClaim(cb){
	  const notify = {type: 'downlink_claim',
					  meta: {network: this.state.props.network,
					  device: this.state.props.devEui}}
	  this.bus.send(notify, cb);
    }
}


class IApplicationServer extends React.Component {
	constructor(props) {
		super(props);
    
		this.state = {form: {port: 5,
							 payload: '01ABFC'},
                  	  packets: [],
                  	  logs: [],
                      props: props};
                  
		this.setPayload = this.setPayload.bind(this);
		this.setPort = this.setPort.bind(this);
		this.sendNotify = this.sendNotify.bind(this);
		this.addLog = this.addLog.bind(this);
		this.addPacket = this.addPacket.bind(this);
	}
  
	setPayload(payload){
	  this.state.form.payload = payload.target.value;
	  this.setState(this.state.form);
	}

	setPort(port){
	  this.state.form.port = parseInt(port.target.value);
	  this.setState(this.state.form);
	}

	sendNotify(){
        this.applicationServer.sendDownlinkClaim(() => this.addLog('The downlink_claim successful published'));
	}
	  
    addPacket(packet){
		const str_packet = JSON.stringify(packet);
		this.state.packets.unshift(str_packet);
		this.setState(this.state.packets);  
    }

	addLog(message){
		this.state.logs.unshift(message);
		this.setState(this.state.logs);
	}

	componentDidMount(){
        this.applicationServer = new ApplicationServer(this.state, this.addPacket, this.addLog);
	}
  
    render() {
        return (
			<div>
				<ISender form={this.state.form} setPayload={this.setPayload} setPort={this.setPort} sendNotify={this.sendNotify} />
				<div className="row gutters ">
					<div className="col col-6 " style={{wordWrap: 'break-word'}}>
						<center>Messages from NS</center>
						<ul>
							{this.state.packets.map(packet => <pre key={packet}><code>{packet}</code></pre>)}
						</ul>
					</div>
					<div className="col col-6 ">
						<center>Logs</center>
						{this.state.logs.map(log => <pre><code>{log}</code></pre>)}
					</div>
				</div>
			</div>
    );
  }
}


class ISender extends React.Component {
	constructor(props) {
		super(props);
		this.state = props.form;
		this.ports = R.range(1, 224);
	}
  
	render() {
		return (
		  <form className="form">
			<div className="row gutters ">
			  <div className="col col-4">
				<div className="form-item">
				  <label>Port</label>
				  <select id="port" value={this.state.port} onChange={this.props.setPort} >
					{this.ports.map(p => <option key={p} value={p}>{p}</option>)}
				  </select>
				</div>
			  </div>
			  <div className="col col-4">
				<div className="form-item">
				  <label>Payload <span className="desc">Hexadecimal payload: eg. 01ABFC</span></label>
				  <input id="payload" type="text" value={this.state.payload} onChange={this.props.setPayload} />
				</div>
			  </div>
			  <div className="col col-4">
				<div className="form-item">
				  <label>Only for class "C"</label>
				  <button type="button" onClick={this.props.sendNotify}>
					Send downlink_claim
				  </button>
				</div>
			  </div>
			</div>
		  </form>
		);
	}
}

ReactDOM.render(<IApplicationServer
                network={config.network}
                devEui={config.device}
                pubNub={{publishKey: config.publishKey,
                         subscribeKey: config.subscribeKey,
                         channelUp: config.channelUp,
                         channelDown: config.channelDown}}
                />,
  	            document.getElementById('app'));
