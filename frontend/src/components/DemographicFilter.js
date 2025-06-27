/**
 * DemographicFilter.js
 * 
 * PURPOSE: Advanced demographic filtering component for querying users based on tags and attributes
 * 
 * FEATURES:
 * - Boolean tag filtering (pregnant: true/false)
 * - String/categorical filtering (location: "Stanford", "Harvard")
 * - Numerical range filtering (age: 18-65)
 * - Multi-value tag filtering (conditions: multiple selections)
 * - Real-time filter preview with result counts
 * - Exportable filter results
 * - Saved filter presets
 * 
 * ARCHITECTURE:
 * - Tag-based system supporting multiple data types
 * - Dynamic filter UI generation based on available tags
 * - Server-side filtering with pagination
 * - Client-side filter state management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Paper,
    Typography,
    Box,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    TextField,
    Slider,
    Chip,
    Button,
    IconButton,
    Divider,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Autocomplete,
    ToggleButton,
    ToggleButtonGroup,
    Card,
    CardContent,
    CardActions,
    Tooltip,
    Badge,
    LinearProgress
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    Download as DownloadIcon,
    Save as SaveIcon,
    Search as SearchIcon,
    People as PeopleIcon,
    TrendingUp as TrendingUpIcon,
    Visibility as VisibilityIcon,
    Settings as SettingsIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import config from '../config';

const DemographicFilter = () => {
    // State management
    const [availableTags, setAvailableTags] = useState({
        demographic: [],
        medical: [],
        behavioral: [],
        device: [],
        custom: []
    });
    const [activeFilters, setActiveFilters] = useState({});
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [resultCount, setResultCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    
    // Dialog states
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [savedPresets, setSavedPresets] = useState([]);
    
    // UI states
    const [expandedSections, setExpandedSections] = useState({
        demographic: true,
        medical: true,
        behavioral: false,
        device: false,
        custom: false
    });

    /**
     * EFFECT: Load available tags and presets on component mount
     */
    useEffect(() => {
        loadAvailableTags();
        loadSavedPresets();
    }, []);

    /**
     * FUNCTION: loadAvailableTags
     * PURPOSE: Fetch all available tags and their possible values from backend
     */
    const loadAvailableTags = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('No authentication token found');
            }
            
            console.log('Loading available tags from:', `${config.API_URL}/api/demographic-tags`);
            
            const response = await axios.get(`${config.API_URL}/api/demographic-tags`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('Available tags loaded:', response.data);
            console.log('Available tags structure:', typeof response.data, Object.keys(response.data || {}));
            
            // Ensure availableTags has the expected structure
            const tags = response.data || {};
            console.log('Processing tags:', tags);
            
            setAvailableTags(tags);
        } catch (error) {
            console.error('Error loading available tags:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            
            let errorMessage = 'Failed to load available demographic tags';
            if (error.response?.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
            } else if (error.response?.status === 403) {
                errorMessage = 'You do not have permission to access demographic tags.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * FUNCTION: loadSavedPresets
     * PURPOSE: Load saved filter presets from localStorage
     */
    const loadSavedPresets = useCallback(() => {
        try {
            const presets = JSON.parse(localStorage.getItem('demographicFilterPresets') || '[]');
            setSavedPresets(presets);
        } catch (error) {
            console.warn('Failed to load saved presets:', error);
        }
    }, []);

    /**
     * FUNCTION: applyFilters
     * PURPOSE: Apply current filters and fetch filtered user data
     */
    const applyFilters = useCallback(async () => {
        if (Object.keys(activeFilters).length === 0) {
            console.log('No filters active, clearing results');
            setFilteredUsers([]);
            setResultCount(0);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('No authentication token found');
            }

            console.log('Applying filters:', activeFilters);
            console.log('API URL:', config.API_URL);
            
            const requestData = {
                filters: activeFilters,
                page: page,
                limit: rowsPerPage
            };
            
            console.log('Request data:', requestData);
            
            const response = await axios.post(`${config.API_URL}/api/demographic-filter`, requestData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('Response received:', response.data);
            
            setFilteredUsers(response.data.users || []);
            setResultCount(response.data.totalCount || 0);
        } catch (error) {
            console.error('Error applying filters:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            
            let errorMessage = 'Failed to apply demographic filters';
            if (error.response?.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
            } else if (error.response?.status === 403) {
                errorMessage = 'You do not have permission to access demographic filtering.';
            } else if (error.response?.status === 500) {
                errorMessage = 'Server error occurred. Please try again later.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setError(errorMessage);
            setFilteredUsers([]);
            setResultCount(0);
        } finally {
            setLoading(false);
        }
    }, [activeFilters, page, rowsPerPage]);

    /**
     * EFFECT: Apply filters when they change
     */
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            applyFilters();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [applyFilters]);

    /**
     * FUNCTION: updateFilter
     * PURPOSE: Update a specific filter value
     */
    const updateFilter = useCallback((filterKey, value) => {
        console.log('Updating filter:', filterKey, value);
        setActiveFilters(prev => {
            if (value === null || value === undefined || value === '' || 
                (Array.isArray(value) && value.length === 0)) {
                const { [filterKey]: removed, ...rest } = prev;
                console.log('Removing filter:', filterKey);
                return rest;
            }
            const newFilters = { ...prev, [filterKey]: value };
            console.log('New filters:', newFilters);
            return newFilters;
        });
        setPage(0); // Reset to first page when filters change
    }, []);

    /**
     * FUNCTION: clearAllFilters
     * PURPOSE: Clear all active filters
     */
    const clearAllFilters = useCallback(() => {
        console.log('Clearing all filters');
        setActiveFilters({});
        setFilteredUsers([]);
        setResultCount(0);
        setPage(0);
    }, []);

    /**
     * FUNCTION: savePreset
     * PURPOSE: Save current filter configuration as a preset
     */
    const savePreset = useCallback(() => {
        if (!presetName.trim()) return;

        const newPreset = {
            id: Date.now(),
            name: presetName.trim(),
            filters: { ...activeFilters },
            created: new Date().toISOString()
        };

        try {
            const updatedPresets = [...savedPresets, newPreset];
            setSavedPresets(updatedPresets);
            localStorage.setItem('demographicFilterPresets', JSON.stringify(updatedPresets));
            
            setPresetName('');
            setSaveDialogOpen(false);
            console.log('Preset saved successfully:', newPreset.name);
        } catch (error) {
            console.error('Error saving preset:', error);
            setError('Failed to save preset');
        }
    }, [presetName, activeFilters, savedPresets]);

    /**
     * FUNCTION: loadPreset
     * PURPOSE: Load a saved filter preset
     */
    const loadPreset = useCallback((preset) => {
        console.log('Loading preset:', preset.name);
        setActiveFilters(preset.filters);
        setPage(0);
    }, []);

    /**
     * FUNCTION: exportResults
     * PURPOSE: Export filtered results to CSV
     */
    const exportResults = useCallback(async () => {
        try {
            setLoading(true);
            console.log('Exporting results with filters:', activeFilters);
            const token = localStorage.getItem('token');
            const response = await axios.post(`${config.API_URL}/api/demographic-filter/export`, {
                filters: activeFilters
            }, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `demographic_filter_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            console.log('Export completed successfully');
        } catch (error) {
            console.error('Error exporting results:', error);
            setError('Failed to export results');
        } finally {
            setLoading(false);
        }
    }, [activeFilters]);

    /**
     * COMPONENT: FilterSection
     * PURPOSE: Render a collapsible filter section
     */
    const FilterSection = ({ title, sectionKey, icon, children }) => {
        // Helper function to safely check if a filter key belongs to this section
        const getActiveFiltersForSection = () => {
            return Object.keys(activeFilters).filter(key => {
                const tagKey = key.split('.')[0];
                const sectionTags = availableTags[sectionKey];
                
                // Handle different possible structures for availableTags
                if (Array.isArray(sectionTags)) {
                    return sectionTags.includes(tagKey);
                } else if (sectionTags && typeof sectionTags === 'object') {
                    return Object.keys(sectionTags).includes(tagKey);
                }
                
                // Fallback: check if the key starts with expected patterns for this section
                switch (sectionKey) {
                    case 'demographic':
                        return ['personal_information', 'device_info'].some(prefix => key.startsWith(prefix));
                    case 'medical':
                        return ['personal_information'].some(prefix => key.startsWith(prefix));
                    case 'behavioral':
                        return ['personal_information'].some(prefix => key.startsWith(prefix));
                    case 'device':
                        return ['device_info'].some(prefix => key.startsWith(prefix));
                    case 'custom':
                        return key.includes('custom');
                    default:
                        return false;
                }
            });
        };

        return (
            <Accordion 
                expanded={expandedSections[sectionKey]}
                onChange={(e, isExpanded) => setExpandedSections(prev => ({ ...prev, [sectionKey]: isExpanded }))}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {icon}
                        <Typography variant="h6">{title}</Typography>
                        <Badge 
                            badgeContent={getActiveFiltersForSection().length} 
                            color="primary"
                        />
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={3}>
                        {children}
                    </Grid>
                </AccordionDetails>
            </Accordion>
        );
    };

    /**
     * COMPONENT: BooleanFilter
     * PURPOSE: Render a boolean tag filter
     */
    const BooleanFilter = ({ label, filterKey, description }) => (
        <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
                <InputLabel>{label}</InputLabel>
                <Select
                    value={activeFilters[filterKey] || ''}
                    onChange={(e) => updateFilter(filterKey, e.target.value)}
                    label={label}
                >
                    <MenuItem value="">Any</MenuItem>
                    <MenuItem value={true}>Yes</MenuItem>
                    <MenuItem value={false}>No</MenuItem>
                </Select>
                {description && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {description}
                    </Typography>
                )}
            </FormControl>
        </Grid>
    );

    /**
     * COMPONENT: MultiSelectFilter
     * PURPOSE: Render a multi-select filter for categorical data
     */
    const MultiSelectFilter = ({ label, filterKey, options, description }) => (
        <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
                multiple
                options={options}
                value={activeFilters[filterKey] || []}
                onChange={(event, newValue) => updateFilter(filterKey, newValue)}
                renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                        <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                    ))
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder="Select options"
                    />
                )}
            />
            {description && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {description}
                </Typography>
            )}
        </Grid>
    );

    /**
     * COMPONENT: RangeFilter
     * PURPOSE: Render a numerical range filter
     */
    const RangeFilter = ({ label, filterKey, min, max, step = 1, unit = '', description }) => {
        const [value, setValue] = useState(activeFilters[filterKey] || [min, max]);

        // Update local state when activeFilters change (e.g., when clearing filters)
        useEffect(() => {
            setValue(activeFilters[filterKey] || [min, max]);
        }, [activeFilters[filterKey], min, max]);

        const handleChange = (event, newValue) => {
            setValue(newValue);
        };

        const handleCommit = (event, newValue) => {
            // Only update if the range is different from default
            updateFilter(filterKey, newValue[0] === min && newValue[1] === max ? null : newValue);
        };

        return (
            <Grid item xs={12} sm={6} md={4}>
                <Typography gutterBottom>{label}</Typography>
                <Box sx={{ px: 2 }}>
                    <Slider
                        value={value}
                        onChange={handleChange}
                        onChangeCommitted={handleCommit}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}${unit}`}
                        min={min}
                        max={max}
                        step={step}
                        marks={[
                            { value: min, label: `${min}${unit}` },
                            { value: max, label: `${max}${unit}` }
                        ]}
                    />
                </Box>
                {description && (
                    <Typography variant="caption" color="text.secondary">
                        {description}
                    </Typography>
                )}
            </Grid>
        );
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Demographic Filter
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    Filter and analyze user populations based on demographic, medical, and behavioral tags
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Filter Panel */}
                <Grid item xs={12} lg={4}>
                    <Paper sx={{ p: 2, height: 'fit-content' }}>
                        {/* Filter Controls */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FilterIcon />
                                Filters
                            </Typography>
                            <Box>
                                <Tooltip title="Save Current Filters">
                                    <IconButton 
                                        onClick={() => setSaveDialogOpen(true)}
                                        disabled={Object.keys(activeFilters).length === 0}
                                    >
                                        <SaveIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Clear All Filters">
                                    <IconButton 
                                        onClick={clearAllFilters}
                                        disabled={Object.keys(activeFilters).length === 0}
                                    >
                                        <ClearIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Refresh Available Tags">
                                    <IconButton onClick={loadAvailableTags}>
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        {/* Active Filters Summary */}
                        {Object.keys(activeFilters).length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Active Filters ({Object.keys(activeFilters).length})
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {Object.entries(activeFilters).map(([key, value]) => (
                                        <Chip
                                            key={key}
                                            label={`${key}: ${Array.isArray(value) ? value.join(', ') : value}`}
                                            onDelete={() => updateFilter(key, null)}
                                            size="small"
                                            variant="outlined"
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Saved Presets */}
                        {savedPresets.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Saved Presets
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {savedPresets.map((preset) => (
                                        <Button
                                            key={preset.id}
                                            variant="outlined"
                                            size="small"
                                            onClick={() => loadPreset(preset)}
                                            sx={{ justifyContent: 'flex-start' }}
                                        >
                                            {preset.name}
                                        </Button>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {loading && <LinearProgress sx={{ mb: 2 }} />}

                        {/* Filter Sections */}
                        <Box sx={{ '& > *:not(:last-child)': { mb: 2 } }}>
                            {/* Demographic Filters */}
                            <FilterSection 
                                title="Demographics" 
                                sectionKey="demographic" 
                                icon={<PeopleIcon />}
                            >
                                <MultiSelectFilter
                                    label="Gender"
                                    filterKey="device_info.gender"
                                    options={['Male', 'Female', 'Other']}
                                    description="Filter by biological sex"
                                />
                                <RangeFilter
                                    label="Age Range"
                                    filterKey="age_range"
                                    min={0}
                                    max={100}
                                    unit=" years"
                                    description="Age in years"
                                />
                                <MultiSelectFilter
                                    label="Location/Institution"
                                    filterKey="personal_information.institution"
                                    options={['Stanford', 'Harvard', 'MIT', 'UCSF', 'Other']}
                                    description="Associated institution or location"
                                />
                            </FilterSection>

                            {/* Medical Filters */}
                            <FilterSection 
                                title="Medical Conditions" 
                                sectionKey="medical" 
                                icon={<TrendingUpIcon />}
                            >
                                <BooleanFilter
                                    label="Pregnant"
                                    filterKey="personal_information.pregnant"
                                    description="Currently pregnant"
                                />
                                <BooleanFilter
                                    label="Diabetes"
                                    filterKey="personal_information.diabetes"
                                    description="Type 1 or Type 2 diabetes"
                                />
                                <BooleanFilter
                                    label="High Blood Pressure"
                                    filterKey="personal_information.high_bp"
                                    description="Hypertension diagnosis"
                                />
                                <MultiSelectFilter
                                    label="Specific Conditions"
                                    filterKey="conditions"
                                    options={['Type 1 Diabetes', 'Type 2 Diabetes', 'Gestational Diabetes', 'Hypertension', 'PCOS', 'Thyroid']}
                                    description="Specific medical conditions"
                                />
                            </FilterSection>

                            {/* Behavioral Filters */}
                            <FilterSection 
                                title="Behavioral/Lifestyle" 
                                sectionKey="behavioral" 
                                icon={<VisibilityIcon />}
                            >
                                <BooleanFilter
                                    label="Smoker"
                                    filterKey="personal_information.smokes"
                                    description="Current smoking status"
                                />
                                <BooleanFilter
                                    label="Drinks Alcohol"
                                    filterKey="personal_information.drinks"
                                    description="Regular alcohol consumption"
                                />
                                <MultiSelectFilter
                                    label="Diet Type"
                                    filterKey="personal_information.diet"
                                    options={['Standard', 'Vegetarian', 'Vegan', 'Keto', 'Low Carb', 'Mediterranean']}
                                    description="Dietary preferences"
                                />
                            </FilterSection>

                            {/* Device/Technical Filters */}
                            <FilterSection 
                                title="Device Information" 
                                sectionKey="device" 
                                icon={<SettingsIcon />}
                            >
                                <MultiSelectFilter
                                    label="Device Type"
                                    filterKey="device_info.deviceID"
                                    options={['CGM-001', 'CGM-002', 'CGM-003']}
                                    description="Sensor device model"
                                />
                                <MultiSelectFilter
                                    label="Sensor Placement"
                                    filterKey="device_info.arm"
                                    options={['Left', 'Right', 'Both']}
                                    description="Sensor placement location"
                                />
                            </FilterSection>

                            {/* Custom Tags */}
                            <FilterSection 
                                title="Custom Tags" 
                                sectionKey="custom" 
                                icon={<SearchIcon />}
                            >
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Custom Tag Search"
                                        placeholder="e.g., Stanford=true, study_group=control"
                                        value={activeFilters.custom_search || ''}
                                        onChange={(e) => updateFilter('custom_search', e.target.value)}
                                        helperText="Format: tag_name=value (supports boolean, string, number)"
                                    />
                                </Grid>
                            </FilterSection>
                        </Box>
                    </Paper>
                </Grid>

                {/* Results Panel */}
                <Grid item xs={12} lg={8}>
                    <Paper sx={{ p: 2 }}>
                        {/* Results Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6">
                                Results ({resultCount} users)
                            </Typography>
                            <Box>
                                <Button
                                    startIcon={<DownloadIcon />}
                                    onClick={exportResults}
                                    disabled={resultCount === 0}
                                    variant="outlined"
                                >
                                    Export CSV
                                </Button>
                            </Box>
                        </Box>

                        {/* Results Table */}
                        {filteredUsers.length > 0 ? (
                            <>
                                <TableContainer>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Username</TableCell>
                                                <TableCell>Age</TableCell>
                                                <TableCell>Gender</TableCell>
                                                <TableCell>Conditions</TableCell>
                                                <TableCell>Institution</TableCell>
                                                <TableCell>Device</TableCell>
                                                <TableCell>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredUsers.map((user) => (
                                                <TableRow key={user.username} hover>
                                                    <TableCell>{user.username}</TableCell>
                                                    <TableCell>{user.device_info?.age || 'N/A'}</TableCell>
                                                    <TableCell>{user.device_info?.gender || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {user.personal_information?.pregnant && (
                                                                <Chip label="Pregnant" size="small" color="info" />
                                                            )}
                                                            {(user.personal_information?.diabetes || user.personal_information?.Diabete) && (
                                                                <Chip label="Diabetes" size="small" color="warning" />
                                                            )}
                                                            {user.personal_information?.high_bp && (
                                                                <Chip label="High BP" size="small" color="error" />
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>{user.personal_information?.institution || 'N/A'}</TableCell>
                                                    <TableCell>{user.device_info?.deviceID || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Tooltip title="View AGP Report">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => window.open(`/agp-report/${user.username}`, '_blank')}
                                                            >
                                                                <VisibilityIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination
                                    component="div"
                                    count={resultCount}
                                    page={page}
                                    onPageChange={(event, newPage) => setPage(newPage)}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={(event) => {
                                        setRowsPerPage(parseInt(event.target.value, 10));
                                        setPage(0);
                                    }}
                                />
                            </>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <PeopleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    {Object.keys(activeFilters).length === 0 
                                        ? 'Configure filters to see results'
                                        : 'No users match the selected criteria'
                                    }
                                </Typography>
                                {Object.keys(activeFilters).length > 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        Try adjusting your filter criteria
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Save Preset Dialog */}
            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
                <DialogTitle>Save Filter Preset</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Preset Name"
                        fullWidth
                        variant="outlined"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="e.g., Pregnant Diabetic Women"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={savePreset} 
                        variant="contained"
                        disabled={!presetName.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DemographicFilter; 