import React, { useState, useEffect, useCallback } from 'react';
import { 
    Container, 
    Typography, 
    Grid, 
    Card, 
    CardContent, 
    Box,
    Alert,
    CircularProgress,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Chip,
    Button,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    TextField
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    Refresh as RefreshIcon,
    Analytics as AnalyticsIcon,
    People as PeopleIcon,
    MedicalServices as MedicalIcon,
    LocalDrink as DrinkIcon,
    SmokingRooms as SmokeIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import config from '../config';

const PopulationAnalysis = () => {
    const [populationData, setPopulationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Filter states
    const [activeFilters, setActiveFilters] = useState({});
    const [filterExpanded, setFilterExpanded] = useState(false);
    const [availableUsers, setAvailableUsers] = useState([]);
    
    // Graph management states
    const [savedGraphs, setSavedGraphs] = useState([]);
    const [maxGraphs] = useState(3);
    const [showGraphLimitDialog, setShowGraphLimitDialog] = useState(false);
    const [pendingGraphData, setPendingGraphData] = useState(null);

    useEffect(() => {
        // Only fetch initial data without filters
        fetchPopulationData();
    }, []); // Empty dependency array - only runs once on mount

    const fetchPopulationData = async (filters = {}) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            const url = new URL(`${config.API_URL}/api/population-analysis`);
            
            // Add filters as query parameters
            if (Object.keys(filters).length > 0) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== null && value !== '' && value !== undefined) {
                        url.searchParams.append(key, value);
                    }
                });
            }
            
            console.log('Fetching population data with filters:', filters);
            console.log('Request URL:', url.toString());

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch population data');
            }

            const data = await response.json();
            console.log('Received population data:', data);
            setPopulationData(data);
            setError(null);
            
            // Log filtering feedback
            if (data.appliedFilters && Object.keys(data.appliedFilters).length > 0) {
                console.log('Backend applied filters:', data.appliedFilters);
                console.log('Filtered user count:', data.filteredUserCount);
            }
            
            return data; // Return the data for immediate use
        } catch (err) {
            console.error('Error fetching population data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Separate function to fetch filtered data without updating main state
    const fetchFilteredData = async (filters) => {
        try {
            const token = localStorage.getItem('token');
            
            const url = new URL(`${config.API_URL}/api/population-analysis`);
            
            // Add filters as query parameters
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== null && value !== '' && value !== undefined) {
                    url.searchParams.append(key, value);
                }
            });
            
            console.log('Fetching filtered data with filters:', filters);
            console.log('Request URL:', url.toString());

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch filtered data');
            }

            const data = await response.json();
            console.log('Received filtered data:', data);
            
            // DON'T update populationData state - just return the data
            return data;
        } catch (err) {
            console.error('Error fetching filtered data:', err);
            throw err; // Re-throw to be handled by caller
        }
    };

    // Filter management functions
    const updateFilter = useCallback((filterKey, value) => {
        console.log(`Updating filter ${filterKey}:`, value);
        setActiveFilters(prev => {
            if (value === null || value === '' || value === undefined) {
                const { [filterKey]: removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [filterKey]: value };
        });
    }, []);

    const clearAllFilters = useCallback(() => {
        console.log('Clearing all filters');
        setActiveFilters({});
    }, []);

    const getFilteredUserCount = () => {
        const filterCount = Object.keys(activeFilters).length;
        if (filterCount === 0) {
            return 'General Population';
        }
        return `${filterCount} filter${filterCount > 1 ? 's' : ''} selected - Click "Create Graph" to apply`;
    };

    // Graph management functions
    const generateGraphTitle = (filters) => {
        const filterDescriptions = [];
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value === 'true') {
                filterDescriptions.push(key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
            } else if (value === 'false') {
                filterDescriptions.push(`Non-${key.replace('_', ' ')}`);
            } else {
                filterDescriptions.push(`${key.replace('_', ' ')}: ${value}`);
            }
        });
        
        if (filterDescriptions.length === 0) return 'Filtered Population';
        if (filterDescriptions.length === 1) return filterDescriptions[0];
        if (filterDescriptions.length === 2) return filterDescriptions.join(' & ');
        return `${filterDescriptions.slice(0, 2).join(' & ')} + ${filterDescriptions.length - 2} more`;
    };

    const deleteGraph = (graphId) => {
        setSavedGraphs(prev => prev.filter(graph => graph.id !== graphId));
    };

    const addPendingGraph = () => {
        if (pendingGraphData) {
            setSavedGraphs(prev => [...prev, pendingGraphData]);
            setPendingGraphData(null);
            setShowGraphLimitDialog(false);
            // Clear filters after successfully adding graph
            setActiveFilters({});
        }
    };

    const cancelPendingGraph = () => {
        setPendingGraphData(null);
        setShowGraphLimitDialog(false);
    };

    const createNewGraph = async () => {
        if (Object.keys(activeFilters).length === 0) {
            setError('Please select at least one filter before creating a graph');
            return;
        }

        try {
            setError(null);
            
            // Fetch filtered data without updating the main populationData state
            const filteredData = await fetchFilteredData(activeFilters);
            
            if (!filteredData) {
                setError('No data received from server');
                return;
            }
            
            // Create a new graph with the filtered data
            const newGraph = {
                id: Date.now(),
                title: generateGraphTitle(activeFilters),
                filters: { ...activeFilters },
                data: filteredData,
                createdAt: new Date().toISOString()
            };
            
            // Check if we can add a new graph
            if (savedGraphs.length >= maxGraphs) {
                setPendingGraphData(newGraph);
                setShowGraphLimitDialog(true);
            } else {
                setSavedGraphs(prev => [...prev, newGraph]);
                // Clear filters after successfully creating graph
                setActiveFilters({});
            }
            
        } catch (err) {
            console.error('Error fetching data for graph:', err);
            setError('Failed to fetch data for graph: ' + err.message);
            return;
        }
    };

    // Filter components
    const BooleanFilter = ({ label, filterKey, description, icon }) => (
        <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ 
                p: 1.5, 
                bgcolor: 'white', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: activeFilters[filterKey] ? 'grey.600' : 'grey.300',
                boxShadow: activeFilters[filterKey] ? 1 : 0,
                transition: 'all 0.2s ease',
                '&:hover': { 
                    borderColor: 'grey.500',
                    boxShadow: 1
                }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    {icon}
                    <Typography variant="body2" fontWeight="bold">{label}</Typography>
                </Box>
                <FormControl fullWidth size="small">
                    <Select
                        value={activeFilters[filterKey] || ''}
                        onChange={(e) => updateFilter(filterKey, e.target.value)}
                        displayEmpty
                        sx={{ 
                            bgcolor: 'grey.50',
                            '& .MuiSelect-select': { 
                                fontWeight: activeFilters[filterKey] ? 'bold' : 'normal'
                            }
                        }}
                    >
                        <MenuItem value="">Any</MenuItem>
                        <MenuItem value="true">Yes</MenuItem>
                        <MenuItem value="false">No</MenuItem>
                    </Select>
                </FormControl>
                {description && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {description}
                    </Typography>
                )}
            </Box>
        </Grid>
    );

    const SelectFilter = ({ label, filterKey, options, description, icon }) => (
        <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ 
                p: 1.5, 
                bgcolor: 'white', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: activeFilters[filterKey] ? 'grey.600' : 'grey.300',
                boxShadow: activeFilters[filterKey] ? 1 : 0,
                transition: 'all 0.2s ease',
                '&:hover': { 
                    borderColor: 'grey.500',
                    boxShadow: 1
                }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    {icon}
                    <Typography variant="body2" fontWeight="bold">{label}</Typography>
                </Box>
                <FormControl fullWidth size="small">
                    <Select
                        value={activeFilters[filterKey] || ''}
                        onChange={(e) => updateFilter(filterKey, e.target.value)}
                        displayEmpty
                        sx={{ 
                            bgcolor: 'grey.50',
                            '& .MuiSelect-select': { 
                                fontWeight: activeFilters[filterKey] ? 'bold' : 'normal'
                            }
                        }}
                    >
                        <MenuItem value="">Any</MenuItem>
                        {options.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {description && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {description}
                    </Typography>
                )}
            </Box>
        </Grid>
    );

    const PopulationCard = ({ title, data, targetRanges, onDelete, graphId, isGeneral = false }) => {
        if (!data) return null;

        const { 
            userCount, 
            averageTimeInTarget, 
            averageTimeHigh, 
            averageTimeVeryHigh, 
            averageTimeLow, 
            averageTimeVeryLow 
        } = data;

        // Calculate heights for stacked bar (out of 100%)
        const veryHighHeight = averageTimeVeryHigh || 0;
        const highHeight = averageTimeHigh || 0;
        const targetHeight = averageTimeInTarget || 0;
        const lowHeight = averageTimeLow || 0;
        const veryLowHeight = averageTimeVeryLow || 0;

        return (
            <Card sx={{ height: '100%', border: 2, borderColor: 'grey.400' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1, textAlign: 'center' }}>
                            {title}
                        </Typography>
                        {!isGeneral && onDelete && (
                            <Tooltip title="Delete this graph">
                                <IconButton 
                                    size="small" 
                                    onClick={() => onDelete(graphId)}
                                    sx={{ color: 'grey.600' }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
                        n = {userCount} users
                    </Typography>

                    {/* Target Goals */}
                    <Box sx={{ mb: 2, textAlign: 'right' }}>
                        <Typography variant="body2" fontWeight="bold">Target</Typography>
                        <Typography variant="body2">&gt;{targetRanges.targetGoal}%</Typography>
                        {targetRanges.highLimit && (
                            <Typography variant="body2">&lt;{targetRanges.highLimit}%</Typography>
                        )}
                        {targetRanges.lowLimit && (
                            <Typography variant="body2">&lt;{targetRanges.lowLimit}%</Typography>
                        )}
                    </Box>

                    {/* Stacked Bar Chart */}
                    <Box sx={{ position: 'relative', height: 300, border: 1, borderColor: 'grey.300' }}>
                        {/* Very High (Red/Orange) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${100 - veryHighHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${veryHighHeight}%`,
                                backgroundColor: '#ff9800',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {veryHighHeight > 5 && `${veryHighHeight.toFixed(1)}%`}
                        </Box>

                        {/* High (Yellow) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${100 - veryHighHeight - highHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${highHeight}%`,
                                backgroundColor: '#ffeb3b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'black',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {highHeight > 5 && `${highHeight.toFixed(1)}%`}
                        </Box>

                        {/* Target (Green) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${veryLowHeight + lowHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${targetHeight}%`,
                                backgroundColor: '#4caf50',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '14px'
                            }}
                        >
                            {targetHeight > 5 && `${targetHeight.toFixed(1)}%`}
                        </Box>

                        {/* Low (Light Red) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: `${veryLowHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${lowHeight}%`,
                                backgroundColor: '#f44336',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {lowHeight > 5 && `${lowHeight.toFixed(1)}%`}
                        </Box>

                        {/* Very Low (Dark Red) */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: `${veryLowHeight}%`,
                                backgroundColor: '#d32f2f',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '12px'
                            }}
                        >
                            {veryLowHeight > 5 && `${veryLowHeight.toFixed(1)}%`}
                        </Box>
                    </Box>

                    {/* Range Labels */}
                    <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption">&gt;{targetRanges.veryHighMin} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.veryHighMin/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption">&gt;{targetRanges.highMin} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.highMin/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" fontWeight="bold">
                                Target Range: {targetRanges.targetMin}-{targetRanges.targetMax} mg/dL
                            </Typography>
                            <Typography variant="caption">
                                ({(targetRanges.targetMin/18).toFixed(1)}-{(targetRanges.targetMax/18).toFixed(1)} mmol/L)
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption">&lt;{targetRanges.lowMax} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.lowMax/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption">&lt;{targetRanges.veryLowMax} mg/dL</Typography>
                            <Typography variant="caption">({(targetRanges.veryLowMax/18).toFixed(1)} mmol/L)</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="center">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error">Error loading population data: {error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Page Header */}
            <Paper sx={{ p: 4, mb: 4, bgcolor: 'primary.main', color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <AnalyticsIcon sx={{ fontSize: 40 }} />
                    <Box>
                        <Typography variant="h4" fontWeight="bold">
                            Population Analysis Dashboard
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.9, mt: 1 }}>
                            Time in Range Analysis by Population Groups - {getFilteredUserCount()}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Filter Panel */}
            <Paper sx={{ mb: 4, overflow: 'hidden' }}>
                <Accordion 
                    expanded={filterExpanded}
                    onChange={(e, isExpanded) => setFilterExpanded(isExpanded)}
                    sx={{ boxShadow: 'none' }}
                >
                    <AccordionSummary 
                        expandIcon={<ExpandMoreIcon />}
                        sx={{ 
                            bgcolor: 'white', 
                            borderBottom: filterExpanded ? '1px solid' : 'none',
                            borderColor: 'divider',
                            '&:hover': { bgcolor: 'grey.50' }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <FilterIcon />
                                <Typography variant="h6" fontWeight="bold">Population Filters</Typography>
                                {Object.keys(activeFilters).length > 0 && (
                                    <Chip 
                                        label={`${Object.keys(activeFilters).length} active`} 
                                        variant="outlined"
                                        size="small"
                                        sx={{ fontWeight: 'bold', borderColor: 'grey.400' }}
                                    />
                                )}
                            </Box>
                            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                                {Object.keys(activeFilters).length > 0 && (
                                    <Tooltip title="Clear All Filters">
                                        <IconButton 
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearAllFilters();
                                            }}
                                            sx={{ 
                                                '&:hover': { bgcolor: 'grey.100' }
                                            }}
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                <Tooltip title="Refresh Data">
                                    <IconButton 
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fetchPopulationData();
                                        }}
                                        sx={{ 
                                            '&:hover': { bgcolor: 'grey.100' }
                                        }}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 2 }}>
                        <Grid container spacing={2}>
                            {/* Demographics Section */}
                            <Grid item xs={12}>
                                <Box sx={{ 
                                    p: 1.5, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1, 
                                    border: '1px solid',
                                    borderColor: 'grey.300'
                                }}>
                                    <Typography variant="subtitle1" sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1, 
                                        mb: 2,
                                        color: 'text.primary',
                                        fontWeight: 'bold'
                                    }}>
                                        <PeopleIcon fontSize="small" />
                                        Demographics
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <SelectFilter
                                            label="Gender"
                                            filterKey="gender"
                                            options={['M', 'F', 'Other']}
                                            description="Filter by gender"
                                        />
                                        <Grid item xs={12} sm={6} md={4}>
                                            <Box sx={{ 
                                                p: 2, 
                                                bgcolor: 'white', 
                                                borderRadius: 1,
                                                border: '1px solid',
                                                borderColor: 'grey.300'
                                            }}>
                                                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                                                    Age Range
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <TextField
                                                        label="Min Age"
                                                        type="number"
                                                        size="small"
                                                        value={activeFilters.ageMin || ''}
                                                        onChange={e => updateFilter('ageMin', e.target.value ? Number(e.target.value) : '')}
                                                        inputProps={{ min: 0, max: 120 }}
                                                        fullWidth
                                                    />
                                                    <TextField
                                                        label="Max Age"
                                                        type="number"
                                                        size="small"
                                                        value={activeFilters.ageMax || ''}
                                                        onChange={e => updateFilter('ageMax', e.target.value ? Number(e.target.value) : '')}
                                                        inputProps={{ min: 0, max: 120 }}
                                                        fullWidth
                                                    />
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                                    Filter by custom age range (0-120 years)
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <SelectFilter
                                            label="Institution"
                                            filterKey="institution"
                                            options={['Stanford', 'Harvard', 'Mayo Clinic', 'Johns Hopkins', 'Other']}
                                            description="Filter by institution"
                                        />
                                    </Grid>
                                </Box>
                            </Grid>

                            {/* Medical Conditions Section */}
                            <Grid item xs={12}>
                                <Box sx={{ 
                                    p: 1.5, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'grey.300'
                                }}>
                                    <Typography variant="subtitle1" sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1, 
                                        mb: 2,
                                        color: 'text.primary',
                                        fontWeight: 'bold'
                                    }}>
                                        <MedicalIcon fontSize="small" />
                                        Medical Conditions
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <BooleanFilter
                                            label="Diabetes"
                                            filterKey="diabetes"
                                            description="Type 1 or Type 2 diabetes"
                                        />
                                        <BooleanFilter
                                            label="High Blood Pressure"
                                            filterKey="high_bp"
                                            description="Hypertension diagnosis"
                                        />
                                        <BooleanFilter
                                            label="Pregnant"
                                            filterKey="pregnant"
                                            description="Currently pregnant"
                                        />
                                        <BooleanFilter
                                            label="Army Personnel"
                                            filterKey="army"
                                            description="Military service member"
                                        />
                                    </Grid>
                                </Box>
                            </Grid>

                            {/* Lifestyle Section */}
                            <Grid item xs={12}>
                                <Box sx={{ 
                                    p: 1.5, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'grey.300'
                                }}>
                                    <Typography variant="subtitle1" sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1, 
                                        mb: 2,
                                        color: 'text.primary',
                                        fontWeight: 'bold'
                                    }}>
                                        <DrinkIcon fontSize="small" />
                                        Lifestyle Factors
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <BooleanFilter
                                            label="Smoker"
                                            filterKey="smokes"
                                            description="Current smoking status"
                                            icon={<SmokeIcon />}
                                        />
                                        <BooleanFilter
                                            label="Drinks Alcohol"
                                            filterKey="drinks"
                                            description="Regular alcohol consumption"
                                            icon={<DrinkIcon />}
                                        />
                                        <SelectFilter
                                            label="Physical Activity"
                                            filterKey="activity_level"
                                            options={['Low', 'Moderate', 'High', 'Very High']}
                                            description="Exercise frequency"
                                        />
                                    </Grid>
                                </Box>
                            </Grid>
                        </Grid>

                        {/* Active Filters Summary */}
                        {Object.keys(activeFilters).length > 0 && (
                            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Active Filters:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {Object.entries(activeFilters).map(([key, value]) => (
                                        <Chip
                                            key={key}
                                            label={`${key.replace('_', ' ')}: ${value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}`}
                                            onDelete={() => updateFilter(key, null)}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    ))}
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                    Graph will be titled: "{generateGraphTitle(activeFilters)}"
                                </Typography>
                            </Box>
                        )}

                        {/* Create Graph Button */}
                        {Object.keys(activeFilters).length > 0 && (
                            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                                <Typography variant="subtitle2" gutterBottom align="center">
                                    Ready to Create: "{generateGraphTitle(activeFilters)}"
                                </Typography>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={createNewGraph}
                                        disabled={savedGraphs.length >= maxGraphs || loading}
                                        size="large"
                                        sx={{ bgcolor: 'grey.800', '&:hover': { bgcolor: 'grey.700' }, '&:disabled': { bgcolor: 'grey.400' } }}
                                    >
                                        {loading ? 'Creating...' : `Create Graph (${savedGraphs.length}/${maxGraphs})`}
                                    </Button>
                                </Box>
                                {savedGraphs.length >= maxGraphs && (
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                                        Maximum graphs reached. Delete a graph to create a new one.
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {/* Filter Instructions */}
                        {Object.keys(activeFilters).length === 0 && (
                            <Box sx={{ mt: 3, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    Select filters above and click "Create Graph" to generate filtered comparison graphs.
                                    The main graph will always show general population data.
                                </Typography>
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            </Paper>

            {/* Saved Graphs Info */}
            {savedGraphs.length > 0 && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                    <Typography variant="h6" gutterBottom>
                        Comparison Graphs ({savedGraphs.length}/{maxGraphs})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {savedGraphs.map((graph) => (
                            <Chip
                                key={graph.id}
                                label={graph.title}
                                onDelete={() => deleteGraph(graph.id)}
                                deleteIcon={<DeleteIcon />}
                                variant="outlined"
                                sx={{ borderColor: 'grey.400' }}
                            />
                        ))}
                    </Box>
                </Box>
            )}

            {/* Filter Status Alert */}
            {Object.keys(activeFilters).length > 0 && (
                <Alert severity="info" sx={{ mb: 3, bgcolor: 'grey.50', color: 'text.primary' }}>
                    <Typography variant="body2">
                        <strong>Filters Selected:</strong> You have selected filters for "{generateGraphTitle(activeFilters)}". 
                        The main graph below still shows general population data. Click "Create Graph" to generate a filtered comparison graph.
                    </Typography>
                </Alert>
            )}

            {/* Dynamic Graphs Section */}
            <Grid container spacing={4}>
                {/* Main Population Display - General or Filtered */}
                <Grid item xs={12} md={savedGraphs.length === 0 ? 12 : savedGraphs.length === 1 ? 6 : 4}>
                    <PopulationCard
                        title="General Population"
                        data={populationData?.general}
                        targetRanges={{
                            targetMin: 70,
                            targetMax: 180,
                            targetGoal: 70,
                            highMin: 180,
                            veryHighMin: 250,
                            lowMax: 70,
                            veryLowMax: 54,
                            highLimit: 25,
                            lowLimit: 4
                        }}
                        isGeneral={true}
                    />
                </Grid>

                {/* Dynamic Filtered Graphs */}
                {savedGraphs.map((graph) => (
                    <Grid key={graph.id} item xs={12} md={savedGraphs.length === 1 ? 6 : 4}>
                        <PopulationCard
                            title={graph.title}
                            data={graph.data?.general}
                            targetRanges={{
                                targetMin: 70,
                                targetMax: 180,
                                targetGoal: 70,
                                highMin: 180,
                                veryHighMin: 250,
                                lowMax: 70,
                                veryLowMax: 54,
                                highLimit: 25,
                                lowLimit: 4
                            }}
                            
                            onDelete={deleteGraph}
                            graphId={graph.id}
                            isGeneral={false}
                        />
                    </Grid>
                ))}
            </Grid>

            
            {/* Legend */}
            <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    Legend:
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#d32f2f' }}></Box>
                            <Typography variant="caption">Very Low</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#f44336' }}></Box>
                            <Typography variant="caption">Low</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#4caf50' }}></Box>
                            <Typography variant="caption">Target Range</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#ffeb3b' }}></Box>
                            <Typography variant="caption">High</Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={2.4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 20, height: 20, backgroundColor: '#ff9800' }}></Box>
                            <Typography variant="caption">Very High</Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Box>

            {/* Graph Limit Dialog */}
            <Dialog open={showGraphLimitDialog} onClose={cancelPendingGraph} maxWidth="md">
                <DialogTitle>Maximum Graphs Reached</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" gutterBottom>
                        You can only have up to {maxGraphs} comparison graphs. 
                        Please delete an existing graph to create: "{pendingGraphData?.title}"
                    </Typography>
                    
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                        Current Graphs:
                    </Typography>
                    <List>
                        {savedGraphs.map((graph) => (
                            <ListItem key={graph.id}>
                                <ListItemText
                                    primary={graph.title}
                                    secondary={`Created: ${new Date(graph.createdAt).toLocaleString()}`}
                                />
                                <ListItemSecondaryAction>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => {
                                            deleteGraph(graph.id);
                                            addPendingGraph();
                                        }}
                                        sx={{ borderColor: 'grey.400', color: 'grey.700', '&:hover': { borderColor: 'grey.600', bgcolor: 'grey.50' } }}
                                    >
                                        Delete & Add New
                                    </Button>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelPendingGraph} sx={{ color: 'grey.700' }}>Cancel</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default PopulationAnalysis; 