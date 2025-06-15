<!DOCTYPE html>
<html lang="en">
<head>
    <!-- [Previous head content remains exactly the same] -->
</head>
<body>
    <!-- [Previous HTML content remains exactly the same until the script section] -->

    <script>
        // Client-side logic
        const socket = io('https://sedate-helix-blender.glitch.me');
        let localStream, peerConnection;
        let isMuted = false;
        let isVideoOff = false;
        let currentRoomId = '';
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };

        // [Theme toggle and DOMContentLoaded functions remain the same]

        async function createRoom() {
            try {
                currentRoomId = generateRoomId();
                document.getElementById('room-id-display').textContent = currentRoomId;
                await initializeLocalStream();
                socket.emit('create-room', currentRoomId);
                showNotification(`Meeting created! ID: ${currentRoomId}`);
            } catch (error) {
                console.error('Error creating room:', error);
                showNotification('Failed to create meeting', 'error');
            }
        }

        function showJoinRoom() {
            document.getElementById('join-room-input').style.display = 'block';
            document.getElementById('join-room-id').value = '';
        }

        async function joinRoom() {
            const roomIdInput = document.getElementById('join-room-id').value.trim();
            if (!roomIdInput.match(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/i)) {
                showNotification('Invalid Meeting ID format. Use xxxx-xxxx-xxxx', 'error');
                return;
            }
            
            try {
                currentRoomId = roomIdInput;
                document.getElementById('room-id-display').textContent = currentRoomId;
                await initializeLocalStream();
                socket.emit('join-room', currentRoomId);
            } catch (error) {
                console.error('Error joining room:', error);
                showNotification('Failed to join meeting', 'error');
            }
        }

        async function initializeLocalStream() {
            try {
                document.getElementById('home-screen').style.display = 'none';
                document.getElementById('video-call-screen').style.display = 'block';
                document.getElementById('join-room-input').style.display = 'none';
                
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                document.getElementById('local-video').srcObject = localStream;
                document.getElementById('no-user-message').style.display = 'block';

                setupPeerConnection();
                setupSocketListeners();
            } catch (error) {
                console.error('Error accessing media devices:', error);
                throw error;
            }
        }

        function setupPeerConnection() {
            peerConnection = new RTCPeerConnection(configuration);
            
            // Add local stream tracks to peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            // Remote stream handler
            peerConnection.ontrack = event => {
                const remoteVideo = document.getElementById('remote-video');
                if (!remoteVideo.srcObject || remoteVideo.srcObject.getTracks().length === 0) {
                    remoteVideo.srcObject = event.streams[0];
                    document.getElementById('no-user-message').style.display = 'none';
                }
            };

            // ICE candidate handler
            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('ice-candidate', { 
                        roomId: currentRoomId, 
                        candidate: event.candidate 
                    });
                }
            };

            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    document.getElementById('no-user-message').style.display = 'block';
                    document.getElementById('no-user-message').textContent = 'Connection lost';
                }
            };
        }

        function setupSocketListeners() {
            socket.on('offer', async ({ offer, roomId }) => {
                if (roomId !== currentRoomId) return;
                
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    socket.emit('answer', { roomId, answer });
                } catch (error) {
                    console.error('Error handling offer:', error);
                    showNotification('Failed to handle offer', 'error');
                    endCall();
                }
            });

            socket.on('answer', async ({ answer, roomId }) => {
                if (roomId !== currentRoomId) return;
                
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error('Error handling answer:', error);
                    showNotification('Failed to handle answer', 'error');
                    endCall();
                }
            });

            socket.on('ice-candidate', async ({ candidate, roomId }) => {
                if (roomId !== currentRoomId || !candidate) return;
                
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            });

            socket.on('user-joined', async ({ roomId }) => {
                if (roomId !== currentRoomId) return;
                
                showNotification('A participant has joined the meeting');
                
                // Only create offer if we're the first user (room creator)
                if (rooms[roomId] && rooms[roomId].users[0] === socket.id) {
                    try {
                        const offer = await peerConnection.createOffer();
                        await peerConnection.setLocalDescription(offer);
                        socket.emit('offer', { roomId, offer });
                    } catch (error) {
                        console.error('Error creating offer:', error);
                        showNotification('Failed to create offer', 'error');
                    }
                }
            });

            socket.on('user-disconnected', ({ roomId }) => {
                if (roomId !== currentRoomId) return;
                
                document.getElementById('no-user-message').style.display = 'block';
                document.getElementById('no-user-message').textContent = 'Participant has left the meeting';
                document.getElementById('remote-video').srcObject = null;
            });

            socket.on('room-error', ({ message, roomId }) => {
                if (roomId && roomId !== currentRoomId) return;
                
                showNotification(message, 'error');
                endCall();
            });
        }

        // [toggleMute, toggleVideo, endCall, generateRoomId, copyRoomId, showNotification functions remain the same]
    </script>
</body>
</html>
