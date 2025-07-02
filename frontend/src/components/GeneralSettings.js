import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Paper, 
    Container, 
    Switch, 
    FormControlLabel, 
    Divider,
    Alert,
    Button
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon } from '@mui/icons-material';

const GeneralSettings = () => {
    const [user, setUser] = useState(null);
    const [settings, setSettings] = useState({
        notifications: true,
        autoRefresh: false,
        darkMode: false,
        compactView: false
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }

            // Load saved settings from localStorage
            const savedSettings = localStorage.getItem('appSettings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }, []);

    const handleSettingChange = (setting) => (event) => {
        setSettings(prev => ({
            ...prev,
            [setting]: event.target.checked
        }));
    };

    const handleSaveSettings = () => {
        try {
            localStorage.setItem('appSettings', JSON.stringify(settings));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <SettingsIcon sx={{ fontSize: 40 }} />
                    <Box>
                        <Typography variant="h4" fontWeight="bold">
                            General Settings
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Configure your application preferences and settings
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {saved && (
                <Alert severity="success" sx={{ mb: 3 }}>
                    Settings saved successfully!
                </Alert>
            )}

            {/* User Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    User Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body1">
                        <strong>Name:</strong> {user?.name || 'Not specified'}
                    </Typography>
                    <Typography variant="body1">
                        <strong>Username:</strong> {user?.username || 'Not specified'}
                    </Typography>
                    <Typography variant="body1">
                        <strong>Role:</strong> {user?.admin ? 'Administrator' : user?.doctor ? 'Doctor' : 'User'}
                    </Typography>
                </Box>
            </Paper>

        </Container>
    );
};

export default GeneralSettings; 