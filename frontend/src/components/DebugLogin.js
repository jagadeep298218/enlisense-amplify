import React, { useState } from 'react';
import axios from 'axios';
import config from '../config';

const DebugLogin = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [debugInfo, setDebugInfo] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const addDebugInfo = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setDebugInfo(prev => [...prev, { message, type, timestamp }]);
        console.log(`[${type.toUpperCase()}] ${message}`);
    };

    const testBackendConnection = async () => {
        addDebugInfo('Testing backend connection...');
        try {
            const response = await fetch(`${config.API_URL}/filetracker`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            addDebugInfo(`Backend reachable. Status: ${response.status}`, response.ok ? 'success' : 'warning');
        } catch (error) {
            addDebugInfo(`Backend connection failed: ${error.message}`, 'error');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setDebugInfo([]);

        addDebugInfo(`Starting login process for user: ${username}`);
        addDebugInfo(`API URL: ${config.API_URL}`);

        try {
            addDebugInfo('Sending login request...');
            const response = await axios.post(`${config.API_URL}/login`, {
                username: username.trim(),
                password
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            addDebugInfo(`Login request successful. Status: ${response.status}`, 'success');
            addDebugInfo(`Response data: ${JSON.stringify(response.data)}`, 'success');

            const { token, user } = response.data;

            if (!token || !user) {
                addDebugInfo('Invalid response: missing token or user data', 'error');
                return;
            }

            addDebugInfo('Storing authentication data...', 'success');
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            addDebugInfo('Calling onLoginSuccess callback...', 'success');
            if (onLoginSuccess && typeof onLoginSuccess === 'function') {
                onLoginSuccess(user);
                addDebugInfo('onLoginSuccess callback completed', 'success');
            } else {
                addDebugInfo('onLoginSuccess callback not available', 'warning');
            }

        } catch (error) {
            addDebugInfo(`Login failed: ${error.message}`, 'error');
            
            if (error.response) {
                addDebugInfo(`Server response: ${error.response.status} - ${JSON.stringify(error.response.data)}`, 'error');
            } else if (error.request) {
                addDebugInfo('No response received from server', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const clearDebugInfo = () => {
        setDebugInfo([]);
    };

    const checkStoredAuth = () => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        addDebugInfo(`Stored token: ${token ? 'EXISTS' : 'NOT FOUND'}`);
        addDebugInfo(`Stored user: ${user ? 'EXISTS' : 'NOT FOUND'}`);
        if (user) {
            try {
                const parsedUser = JSON.parse(user);
                addDebugInfo(`User data: ${JSON.stringify(parsedUser)}`);
            } catch (e) {
                addDebugInfo('User data corrupted', 'error');
            }
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Debug Login Page</h1>
            
            <div style={{ marginBottom: '20px' }}>
                <button onClick={testBackendConnection} style={{ marginRight: '10px' }}>
                    Test Backend Connection
                </button>
                <button onClick={checkStoredAuth} style={{ marginRight: '10px' }}>
                    Check Stored Auth
                </button>
                <button onClick={clearDebugInfo}>
                    Clear Debug Info
                </button>
            </div>

            <form onSubmit={handleLogin} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                    <label>Username:</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{ marginLeft: '10px', padding: '5px' }}
                        placeholder="Enter username"
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ marginLeft: '10px', padding: '5px' }}
                        placeholder="Enter password"
                    />
                </div>
                <button type="submit" disabled={isLoading || !username || !password}>
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>

            <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '5px',
                maxHeight: '400px',
                overflowY: 'auto'
            }}>
                <h3>Debug Information:</h3>
                {debugInfo.length === 0 ? (
                    <p>No debug information yet. Try logging in or testing the backend connection.</p>
                ) : (
                    debugInfo.map((info, index) => (
                        <div key={index} style={{ 
                            marginBottom: '5px',
                            color: info.type === 'error' ? 'red' : info.type === 'success' ? 'green' : info.type === 'warning' ? 'orange' : 'black'
                        }}>
                            <span style={{ fontSize: '12px', color: '#666' }}>[{info.timestamp}]</span> {info.message}
                        </div>
                    ))
                )}
            </div>

            <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                <p><strong>Expected Test Credentials:</strong></p>
                <p>Check your backend server or database for valid login credentials.</p>
                <p><strong>Current API URL:</strong> {config.API_URL}</p>
                <p><strong>Current URL:</strong> {window.location.href}</p>
            </div>
        </div>
    );
};

export default DebugLogin; 