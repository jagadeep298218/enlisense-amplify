/**
 * FILE: Login.js
 * PURPOSE: User authentication component with JWT token management
 * DESCRIPTION: Provides secure login interface for the EnLiSense Dashboard with form validation,
 *              error handling, and persistent authentication state management.
 * 
 * FEATURES:
 * - Secure JWT-based authentication
 * - Form validation with user feedback
 * - Persistent login state via localStorage
 * - Error handling with user-friendly messages
 * - Loading state management
 * 
 * SECURITY CONSIDERATIONS:
 * - Credentials are sent over HTTPS (ensure in production)
 * - JWT tokens stored in localStorage (consider httpOnly cookies for enhanced security)
 * - Password fields are properly masked
 * 
 * ERROR HANDLING:
 * - [CRITICAL] Network failures during authentication
 *   FIX: Add retry mechanism and offline state detection
 * - [HIGH] Invalid credentials provide clear feedback
 *   FIX: Implement rate limiting to prevent brute force attacks
 * - [MEDIUM] localStorage may not be available in private browsing
 *   FIX: Graceful fallback when storage is unavailable
 * - [LOW] Form validation edge cases (empty spaces, special characters)
 *   FIX: Enhanced input sanitization and validation
 */

import React, { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import './Login.css';

/**
 * COMPONENT: Login
 * PURPOSE: Authentication form component with secure login handling
 * 
 * PROPS:
 * - onLoginSuccess: function - Callback executed after successful authentication
 * 
 * STATE:
 * - username: string - User's login identifier
 * - password: string - User's password (not stored persistently)
 * - error: string - Error message for user feedback
 * - isLoading: boolean - Loading state during authentication
 * 
 * SECURITY FEATURES:
 * - Password masking in UI
 * - Secure token storage
 * - Error message sanitization
 */
const Login = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    /**
     * FUNCTION: validateForm
     * PURPOSE: Client-side form validation before submission
     * RETURNS: { isValid: boolean, errors: string[] }
     * OPTIMIZATION: Memoized to prevent recreation on every render
     */
    const validateForm = useCallback(() => {
        const errors = [];
        
        // Username validation
        if (!username || username.trim().length === 0) {
            errors.push('Username is required');
        } else if (username.trim().length < 3) {
            errors.push('Username must be at least 3 characters');
        } else if (username.length > 50) {
            errors.push('Username must be less than 50 characters');
        }
        
        // Password validation
        if (!password || password.length === 0) {
            errors.push('Password is required');
        } else if (password.length < 4) {
            errors.push('Password must be at least 4 characters');
        } else if (password.length > 100) {
            errors.push('Password must be less than 100 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }, [username, password]);

    /**
     * FUNCTION: handleSubmit
     * PURPOSE: Process login form submission with comprehensive error handling
     * PARAMETERS: e - Form submission event
     * 
     * PROCESS:
     * 1. Prevent default form submission
     * 2. Validate form inputs
     * 3. Send authentication request
     * 4. Handle success/failure scenarios
     * 5. Store authentication data securely
     * 
     * ERROR HANDLING:
     * - Network timeouts and connectivity issues
     * - Invalid credentials with user feedback
     * - Server errors with fallback messages
     * - localStorage access failures
     */
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');
        
        // Client-side validation
        const validation = validateForm();
        if (!validation.isValid) {
            setError(validation.errors.join('. '));
            return;
        }
        
        setIsLoading(true);

        try {
            // Configure request with timeout
            const response = await axios.post('http://localhost:3000/login', {
                username: username.trim(),
                password
            }, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Validate response structure
            const { token, user } = response.data;
            
            if (!token || !user) {
                throw new Error('Invalid response from server');
            }
            
            // Secure storage with error handling
            try {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
            } catch (storageError) {
                console.warn('Failed to store authentication data:', storageError);
                // Continue with login but warn user about session persistence
                setError('Login successful but session may not persist. Please log in again if needed.');
            }
            
            // Clear sensitive data from memory
            setPassword('');
            
            // Execute success callback
            if (onLoginSuccess && typeof onLoginSuccess === 'function') {
                onLoginSuccess(user);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            
            // Provide specific error messages based on error type
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.code === 'ECONNABORTED') {
                errorMessage = 'Login request timed out. Please check your connection and try again.';
            } else if (error.response) {
                // Server responded with error status
                const status = error.response.status;
                const serverMessage = error.response.data?.error;
                
                switch (status) {
                    case 401:
                        errorMessage = 'Invalid username or password. Please try again.';
                        break;
                    case 403:
                        errorMessage = 'Account access denied. Please contact support.';
                        break;
                    case 429:
                        errorMessage = 'Too many login attempts. Please wait before trying again.';
                        break;
                    case 500:
                    case 502:
                    case 503:
                        errorMessage = 'Server error. Please try again later.';
                        break;
                    default:
                        errorMessage = serverMessage || `Login failed (${status}). Please try again.`;
                }
            } else if (error.request) {
                // Network error
                errorMessage = 'Unable to connect to server. Please check your internet connection.';
            }
            
            setError(errorMessage);
            
            // Clear password on error for security
            setPassword('');
            
        } finally {
            setIsLoading(false);
        }
    }, [username, password, validateForm, onLoginSuccess]);

    /**
     * MEMOIZED VALUE: Form Submit Button Props
     * PURPOSE: Optimize button state calculations
     * DEPENDENCIES: [isLoading, username, password]
     */
    const submitButtonProps = useMemo(() => {
        const validation = validateForm();
        return {
            disabled: isLoading || !validation.isValid,
            text: isLoading ? 'Logging in...' : 'Login'
        };
    }, [isLoading, validateForm]);

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>EnLiSense Dashboard Login</h2>
                
                {error && (
                    <div className="error-message" role="alert" aria-live="polite">
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} noValidate>
                    <div className="form-group">
                        <label htmlFor="username">
                            Username *
                        </label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isLoading}
                            aria-describedby={error ? "error-message" : undefined}
                            autoComplete="username"
                            placeholder="Enter your username"
                            maxLength={50}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">
                            Password *
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            aria-describedby={error ? "error-message" : undefined}
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            maxLength={100}
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={submitButtonProps.disabled}
                        className={isLoading ? 'loading' : ''}
                        aria-label={submitButtonProps.text}
                    >
                        {submitButtonProps.text}
                    </button>
                </form>
                
                <div className="login-footer">
                    <small>
                        Secure access to your biomarker dashboard
                    </small>
                </div>
            </div>
        </div>
    );
};

export default Login; 