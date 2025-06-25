/**
 * PatientComparison.js
 * 
 * PURPOSE: User interface component for selecting two patients to compare their AGP reports
 * 
 * FEATURES:
 * - Dual patient selection with dropdowns showing patient metadata
 * - Biomarker type switching (glucose/cortisol) for appropriate comparisons
 * - Input validation preventing invalid comparisons (same patient, missing selections)
 * - Patient availability checking with helpful feedback messages
 * - Responsive grid layout optimized for various screen sizes
 * 
 * DEPENDENCIES:
 * - Material-UI components for consistent form styling
 * - React Router for navigation to comparison views
 * - Icons for enhanced visual feedback
 * 
 * ERROR HANDLING:
 * - [MEDIUM] Input validation with clear error messages
 * - [LOW] Empty patient list handled with informative alerts
 * - [LOW] Navigation failures caught by router error boundary
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Paper,
    Typography,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    Alert,
    Grid
} from '@mui/material';
import {
    Compare as CompareIcon,
    Person as PersonIcon
} from '@mui/icons-material';

const PatientComparison = ({ patients }) => {
    const [patient1, setPatient1] = useState('');
    const [patient2, setPatient2] = useState('');
    const [biomarkerType, setBiomarkerType] = useState('glucose');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    /**
     * MEMOIZED CALCULATION: Available Patients
     * PURPOSE: Filter and prepare patient list for selection dropdowns
     * OPTIMIZATION: Only recalculates when patients array changes
     * 
     * ERROR HANDLING:
     * - [LOW] Handles null/undefined patients gracefully
     * - [LOW] Filters out patients without usernames
     */
    const availablePatients = useMemo(() => {
        if (!patients || !Array.isArray(patients)) {
            return [];
        }
        return patients.filter(p => p?.username);
    }, [patients]);

    /**
     * FUNCTION: validateComparison
     * PURPOSE: Validate patient selection before navigation
     * RETURNS: Boolean indicating if comparison is valid
     * 
     * ERROR HANDLING:
     * - [MEDIUM] Clear validation messages for user guidance
     * - [LOW] Prevents unnecessary API calls with invalid data
     */
    const validateComparison = useCallback(() => {
        setError('');

        if (!patient1 || !patient2) {
            setError('Please select both patients to compare');
            return false;
        }

        if (patient1 === patient2) {
            setError('Please select two different patients');
            return false;
        }

        return true;
    }, [patient1, patient2]);

    /**
     * FUNCTION: handleCompare
     * PURPOSE: Validate inputs and navigate to comparison view
     * 
     * PROCESS:
     * 1. Validate patient selections
     * 2. Clear any existing errors
     * 3. Navigate to AGP comparison route with parameters
     * 
     * ERROR HANDLING:
     * - [MEDIUM] Input validation prevents invalid navigation
     * - [LOW] Navigation errors handled by router
     */
    const handleCompare = useCallback(() => {
        if (validateComparison()) {
            navigate(`/agp-comparison/${patient1}/${patient2}/${biomarkerType}`);
        }
    }, [validateComparison, navigate, patient1, patient2, biomarkerType]);

    /**
     * FUNCTION: handleBiomarkerChange
     * PURPOSE: Update biomarker type selection with validation
     * 
     * ERROR HANDLING:
     * - [LOW] Prevents null/undefined biomarker selections
     */
    const handleBiomarkerChange = useCallback((event, newType) => {
        if (newType) {
            setBiomarkerType(newType);
        }
    }, []);

    /**
     * FUNCTION: renderPatientOption
     * PURPOSE: Render patient selection option with metadata
     * PARAMETERS: patient - Patient object with username and device_info
     * 
     * ERROR HANDLING:
     * - [LOW] Handles missing device_info gracefully
     * - [LOW] Displays fallback values for missing patient data
     */
    const renderPatientOption = useCallback((patient) => (
        <MenuItem key={patient.username} value={patient.username}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" />
                {patient.username}
                {patient.device_info?.gender && (
                    <Typography variant="caption" color="text.secondary">
                        ({patient.device_info.gender}, {patient.device_info.age || 'N/A'})
                    </Typography>
                )}
            </Box>
        </MenuItem>
    ), []);

    /**
     * MEMOIZED COMPONENT: Compare Button
     * PURPOSE: Optimize button rendering with proper disabled state
     * OPTIMIZATION: Prevents unnecessary re-renders when props haven't changed
     */
    const compareButton = useMemo(() => (
        <Button
            onClick={handleCompare}
            variant="contained"
            startIcon={<CompareIcon />}
            disabled={!patient1 || !patient2 || patient1 === patient2}
            fullWidth
            size="small"
        >
            Compare
        </Button>
    ), [handleCompare, patient1, patient2]);

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CompareIcon color="primary" />
                Compare AGP Reports
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select two patients to compare their AGP (Ambulatory Glucose Profile) reports side by side.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Patient 1</InputLabel>
                        <Select
                            value={patient1}
                            label="Patient 1"
                            onChange={(e) => setPatient1(e.target.value)}
                        >
                            {availablePatients.map(renderPatientOption)}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">vs</Typography>
                </Grid>

                <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Patient 2</InputLabel>
                        <Select
                            value={patient2}
                            label="Patient 2"
                            onChange={(e) => setPatient2(e.target.value)}
                        >
                            {availablePatients.map(renderPatientOption)}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} sm={3}>
                    <ToggleButtonGroup
                        value={biomarkerType}
                        exclusive
                        onChange={handleBiomarkerChange}
                        size="small"
                        fullWidth
                    >
                        <ToggleButton value="glucose">Glucose</ToggleButton>
                        <ToggleButton value="cortisol">Cortisol</ToggleButton>
                    </ToggleButtonGroup>
                </Grid>

                <Grid item xs={12} sm={2}>
                    {compareButton}
                </Grid>
            </Grid>

            {availablePatients.length < 2 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    At least 2 patients are required to use the comparison feature.
                    {availablePatients.length === 0 && " No patients are currently available."}
                    {availablePatients.length === 1 && " Only 1 patient is currently available."}
                </Alert>
            )}
        </Paper>
    );
};

export default PatientComparison; 