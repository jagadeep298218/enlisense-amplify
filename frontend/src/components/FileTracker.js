import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './FileTracker.css';

const FileTracker = () => {
    const [fileData, setFileData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('No authentication token found');
                    setLoading(false);
                    return;
                }

                const response = await axios.get('http://localhost:3000/filetracker', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                setFileData(response.data);
                setLoading(false);
            } catch (err) {
                setError('Error fetching data: ' + err.message);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const getUserType = (file) => {
        if (file.admin) return 'Admin';
        if (file.doctor) return 'Doctor';
        if (file.patient) return 'Patient';
        return 'User';
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    };

    const handleCardClick = (username) => {
        navigate(`/user-versions/${username}`);
    };

    const handleDownloadCSV = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No authentication token found');
                return;
            }

            const response = await axios.get('http://localhost:3000/filetracker/download-csv', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                responseType: 'blob' // Important for handling file downloads
            });

            // Create a blob from the response data
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'filetracker-data.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError('Error downloading CSV: ' + err.message);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="file-tracker">
            <div className="header">
                <h2>File Tracker Data</h2>
                <div className="user-info">
                    {user && (
                        <>
                            <span>Welcome, {user.name || user.username}</span>
                            <span className="user-type">({getUserType(user)})</span>
                            {user.admin && (
                                <button onClick={handleDownloadCSV} className="download-btn">
                                    Download CSV
                                </button>
                            )}
                            <button onClick={handleLogout} className="logout-btn">Logout</button>
                        </>
                    )}
                </div>
            </div>
            <div className="file-list">
                {fileData.map((file, index) => (
                    <div 
                        key={index} 
                        className="file-item"
                        onClick={() => handleCardClick(file.username)}
                    >
                        <h3>{file.username || 'User Profile'}</h3>
                        <div className="file-details">
                            <p><strong>Username:</strong> {file.username}</p>
                            <p><strong>File ID:</strong> {file._id}</p>
                            <p><strong>Last Modified:</strong> {formatDate(file.last_modified)}</p>
                            {file.processed_at && (
                                <p><strong>Processed At:</strong> {formatDate(file.processed_at.$date?.$numberLong ? new Date(parseInt(file.processed_at.$date.$numberLong)) : file.processed_at)}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FileTracker; 