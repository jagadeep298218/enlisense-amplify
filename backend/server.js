//Jagadeep Kalluri
//server.js: backend server for the s3-mongodb-app

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors'); //lets the backend communicate with the frontend
const jwt = require('jsonwebtoken'); //used to verify the token
const { Parser } = require('json2csv'); //used to convert the data to csv
const multer = require('multer'); //used to handle file uploads
const csv = require('csv-parser'); //used to parse CSV files
const fs = require('fs');

const app = express();
const port = 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variable

app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uri = 'mongodb+srv://s3-mongodb-lambda-user:eimYcXJoDU9382sw@s3-mongodb-cluster.venvicc.mongodb.net/?retryWrites=true&w=majority&appName=s3-mongodb-cluster';
const client = new MongoClient(uri);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

//Get all data from the filetracker (used to test if able to connect and retrieve data from mongodb)
async function getFileTrackerData() {
    const db = client.db('s3-mongodb-db');
    const collection = db.collection('s3-mongodb-file_tracker');
    const data = await collection.find({}).toArray();
    return data;
}

//Get version data of specific patients from the data versions collection       
async function getUserVersions(patientId) {
    const db = client.db('s3-mongodb-db');
    const collection = db.collection('s3-mongodb-data-versions');
    return await collection.find({ patient_id: patientId }).sort({ versioned_at: -1 }).toArray();
}

// Used to find a specific user and get the information from filetracker
async function findUser(username) {
    const db = client.db('s3-mongodb-db');
    const collection = db.collection('s3-mongodb-file_tracker');
    return await collection.findOne({ username: username });
}

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await findUser(username);

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({
            username: user.username,
            admin: user.admin,
            doctor: user.doctor,
            patient: user.patient,
            patients: user.patients || []
        }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            token,
            user: {
                username: user.username,
                name: user.name,
                admin: user.admin,
                doctor: user.doctor,
                patient: user.patient
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Protected filetracker endpoint
app.get('/filetracker', authenticateToken, async (req, res) => {
    try {
        const allData = await getFileTrackerData();
        let filteredData;

        if (req.user.admin) {
            // Admins can see all data except their own profile
            filteredData = allData.filter(entry => entry.username !== req.user.username);
        } else if (req.user.doctor) {
            // Doctors can see their patients' data but not their own profile
            filteredData = allData.filter(entry => 
                entry.username !== req.user.username && 
                req.user.patients.includes(entry.username)
            );
        } else {
            // Patients can only see their own data
            filteredData = allData.filter(entry => 
                entry.username === req.user.username
            );
        }

        res.status(200).json(filteredData);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data from MongoDB' });
    }
});

// New endpoint for user versions
app.get('/user-versions/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Check authorization
        if (!req.user.admin && 
            req.user.username !== username && 
            !req.user.patients?.includes(username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        const versions = await getUserVersions(username);
        res.status(200).json(versions);
    } catch (error) {
        console.error('Error fetching user versions:', error);
        res.status(500).json({ error: 'Failed to fetch user versions' });
    }
});

// New endpoint for user device info
app.get('/user-device-info/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Check authorization
        if (!req.user.admin && 
            req.user.username !== username && 
            !req.user.patients?.includes(username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        const db = client.db('s3-mongodb-db');
        const collection = db.collection('s3-mongodb-file_tracker');
        const userRecord = await collection.findOne({ username: username });
        
        if (!userRecord) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(userRecord);
    } catch (error) {
        console.error('Error fetching user device info:', error);
        res.status(500).json({ error: 'Failed to fetch user device info' });
    }
});

// New endpoint for user sensor data using etag
app.get('/user-sensor-data/:etag', authenticateToken, async (req, res) => {
    try {
        const { etag } = req.params;
        
        const db = client.db('s3-mongodb-db');
        const collection = db.collection('s3-mongodb-data-entries');
        const dataEntry = await collection.findOne({ etag: etag });
        
        if (!dataEntry) {
            return res.status(404).json({ error: 'Sensor data not found for this etag' });
        }

        // Check authorization - verify the user has access to this data
        const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
        const fileRecord = await fileTrackerCollection.findOne({ etag: etag });
        
        if (fileRecord && !req.user.admin && 
            req.user.username !== fileRecord.username && 
            !req.user.patients?.includes(fileRecord.username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        res.status(200).json(dataEntry);
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        res.status(500).json({ error: 'Failed to fetch sensor data' });
    }
});

// New endpoint for data versions by patient_id
app.get('/data-versions/:patientId', authenticateToken, async (req, res) => {
    try {
        const { patientId } = req.params;
        console.log(`Received request for data versions with patient_id: ${patientId}`);
        console.log('User making request:', req.user.username, 'Admin:', req.user.admin, 'Patients:', req.user.patients);
        
        // Check authorization - verify user can access this patient's data
        // For patient_id like "Test_output", we need to find which username owns this data
        // and then check if the requesting user has access to that username
        let isAuthorized = false;
        
        if (req.user.admin) {
            // Admins have access to all data
            isAuthorized = true;
        } else {
            // For doctors and patients, we need to find the username associated with this patientId
            const db = client.db('s3-mongodb-db');
            const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
            
            // Find the file that corresponds to this patientId
            const fileRecord = await fileTrackerCollection.findOne({
                _id: { $regex: patientId, $options: 'i' }
            });
            
            if (fileRecord) {
                const fileOwnerUsername = fileRecord.username;
                console.log(`Found file record for patient_id ${patientId}, owned by username: ${fileOwnerUsername}`);
                
                // Check if the requesting user has access to this file owner's data
                if (req.user.username === fileOwnerUsername || 
                    (req.user.patients && req.user.patients.includes(fileOwnerUsername))) {
                    isAuthorized = true;
                    console.log('Access granted - user has access to this patient data');
                } else {
                    console.log('Access denied - user does not have access to this patient data');
                }
            } else {
                console.log(`No file record found for patient_id: ${patientId}`);
            }
        }
        
        if (!isAuthorized) {
            console.log('Authorization failed for patient_id:', patientId);
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        const db = client.db('s3-mongodb-db');
        const versionsCollection = db.collection('s3-mongodb-data-versions');
        
        // Find versions by patient_id
        console.log(`Searching for versions with patient_id: ${patientId}`);
        const versions = await versionsCollection.find({ 
            patient_id: patientId 
        }).sort({ versioned_at: -1 }).toArray();
        
        console.log(`Found ${versions.length} versions for patient_id: ${patientId}`);
        if (versions.length > 0) {
            console.log('Sample version:', JSON.stringify(versions[0], null, 2));
        }
        res.status(200).json(versions);
    } catch (error) {
        console.error('Error fetching data versions:', error);
        res.status(500).json({ error: 'Failed to fetch data versions' });
    }
});

// New endpoint for specific version data
app.get('/version-data/:versionId', authenticateToken, async (req, res) => {
    try {
        const { versionId } = req.params;
        console.log(`Received request for version data with ID: ${versionId}`);
        
        const db = client.db('s3-mongodb-db');
        const versionsCollection = db.collection('s3-mongodb-data-versions');
        
        // Try to create ObjectId, handle both ObjectId and string formats
        let query;
        try {
            query = { _id: new ObjectId(versionId) };
        } catch (objectIdError) {
            // If ObjectId creation fails, try as string
            console.log('ObjectId creation failed, trying as string:', objectIdError.message);
            query = { _id: versionId };
        }
        
        console.log('Searching for version with query:', query);
        const versionData = await versionsCollection.findOne(query);
        
        if (!versionData) {
            console.log('Version data not found for ID:', versionId);
            return res.status(404).json({ error: 'Version data not found' });
        }

        console.log('Found version data, patient_id:', versionData.patient_id);

        // Check authorization based on patient_id in the version data
        const patientId = versionData.patient_id;
        let isAuthorized = false;
        
        if (req.user.admin) {
            // Admins have access to all data
            isAuthorized = true;
        } else {
            // For doctors and patients, we need to find the username associated with this patientId
            const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
            
            // Find the file that corresponds to this patientId
            const fileRecord = await fileTrackerCollection.findOne({
                _id: { $regex: patientId, $options: 'i' }
            });
            
            if (fileRecord) {
                const fileOwnerUsername = fileRecord.username;
                console.log(`Found file record for patient_id ${patientId}, owned by username: ${fileOwnerUsername}`);
                
                // Check if the requesting user has access to this file owner's data
                if (req.user.username === fileOwnerUsername || 
                    (req.user.patients && req.user.patients.includes(fileOwnerUsername))) {
                    isAuthorized = true;
                    console.log('Access granted - user has access to this version data');
                } else {
                    console.log('Access denied - user does not have access to this version data');
                }
            } else {
                console.log(`No file record found for patient_id: ${patientId}`);
            }
        }
        
        if (!isAuthorized) {
            console.log('Authorization failed for version data, patient_id:', patientId);
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        console.log('Sending version data successfully');
        res.status(200).json(versionData);
    } catch (error) {
        console.error('Error fetching version data:', error);
        res.status(500).json({ error: 'Failed to fetch version data' });
    }
});

// CSV download endpoint
app.get('/filetracker/download-csv', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.admin) {
            return res.status(403).json({ error: 'Only administrators can download CSV data' });
        }

        const allData = await getFileTrackerData();
        
        // Configure the CSV parser
        const fields = ['username', '_id', 'device_info.userID', 'device_info.deviceID', 'device_info.gender', 'device_info.age', 'device_info.arm', 'device_info.sensorCombination', 'last_modified', 'processed_at'];
        const json2csvParser = new Parser({ fields });
        
        // Convert to CSV
        const csv = json2csvParser.parse(allData);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=filetracker-data.csv');
        // Send the CSV file
        res.status(200).send(csv);
    } catch (error) {
        console.error('Error generating CSV:', error);
        res.status(500).json({ error: 'Failed to generate CSV file' });
    }
});

// CSV upload endpoint for personal information
app.post('/upload-personal-info', authenticateToken, upload.single('csvFile'), async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.admin) {
            return res.status(403).json({ error: 'Only administrators can upload personal information' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }

        const csvData = [];
        const stream = fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => {
                // Convert boolean strings to actual booleans
                const processedData = {};
                for (const key in data) {
                    let value = data[key];
                    if (value === 'TRUE' || value === 'true') {
                        value = true;
                    } else if (value === 'FALSE' || value === 'false') {
                        value = false;
                    }
                    processedData[key] = value;
                }
                csvData.push(processedData);
            })
            .on('end', async () => {
                try {
                    const db = client.db('s3-mongodb-db');
                    const collection = db.collection('s3-mongodb-data-entries');
                    
                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];

                    // Process each row from CSV
                    for (const row of csvData) {
                        try {
                            const { username, ...personalInfo } = row;
                            
                            if (!username) {
                                errors.push(`Row missing username: ${JSON.stringify(row)}`);
                                errorCount++;
                                continue;
                            }

                            // Update or insert personal information for the user
                            const result = await collection.updateOne(
                                { username: username },
                                { 
                                    $set: { 
                                        personal_information: personalInfo,
                                        updated_at: new Date()
                                    },
                                    $setOnInsert: {
                                        username: username,
                                        created_at: new Date()
                                    }
                                },
                                { upsert: true }
                            );

                            successCount++;
                            console.log(`Updated personal info for user: ${username}`);
                            
                        } catch (userError) {
                            console.error(`Error processing user ${row.username}:`, userError);
                            errors.push(`Error for user ${row.username}: ${userError.message}`);
                            errorCount++;
                        }
                    }

                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);

                    res.json({
                        message: 'Personal information upload completed',
                        successCount,
                        errorCount,
                        totalRows: csvData.length,
                        errors: errors.length > 0 ? errors : undefined
                    });

                } catch (dbError) {
                    console.error('Database error during CSV processing:', dbError);
                    fs.unlinkSync(req.file.path);
                    res.status(500).json({ error: 'Database error during processing' });
                }
            })
            .on('error', (streamError) => {
                console.error('CSV parsing error:', streamError);
                fs.unlinkSync(req.file.path);
                res.status(400).json({ error: 'Invalid CSV format' });
            });

    } catch (error) {
        console.error('Error processing CSV upload:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to process CSV file' });
    }
});

// Get personal information for a user
app.get('/user-personal-info/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Check authorization
        if (!req.user.admin && 
            req.user.username !== username && 
            !req.user.patients?.includes(username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        const db = client.db('s3-mongodb-db');
        const collection = db.collection('s3-mongodb-data-entries');
        const userRecord = await collection.findOne(
            { username: username },
            { projection: { personal_information: 1, username: 1, updated_at: 1 } }
        );
        
        if (!userRecord || !userRecord.personal_information) {
            return res.status(404).json({ error: 'Personal information not found for this user' });
        }

        res.status(200).json({
            username: userRecord.username,
            personal_information: userRecord.personal_information,
            updated_at: userRecord.updated_at
        });
    } catch (error) {
        console.error('Error fetching personal info:', error);
        res.status(500).json({ error: 'Failed to fetch personal information' });
    }
});

// Debug endpoint to check user data structure
app.get('/debug-user-data/:username', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.admin) {
            return res.status(403).json({ error: 'Only administrators can access debug data' });
        }

        const { username } = req.params;
        const db = client.db('s3-mongodb-db');
        const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
        const dataEntriesCollection = db.collection('s3-mongodb-data-entries');

        // Get user file info
        const userFileInfo = await fileTrackerCollection.findOne({ username: username });
        
        let debugInfo = {
            username: username,
            fileTrackerExists: !!userFileInfo,
            userFileInfo: userFileInfo ? {
                hasEtag: !!userFileInfo.etag,
                etag: userFileInfo.etag,
                deviceInfo: userFileInfo.device_info
            } : null,
            sensorDataExists: false,
            sampleDataEntry: null,
            dataFieldsFound: []
        };

        if (userFileInfo && userFileInfo.etag) {
            const sensorDataEntry = await dataEntriesCollection.findOne({ etag: userFileInfo.etag });
            debugInfo.sensorDataExists = !!sensorDataEntry;
            
            if (sensorDataEntry) {
                debugInfo.hasDataArray = !!sensorDataEntry.data;
                debugInfo.dataArrayLength = sensorDataEntry.data ? sensorDataEntry.data.length : 0;
                debugInfo.dataArrayType = sensorDataEntry.data ? typeof sensorDataEntry.data : 'undefined';
                debugInfo.isArrayActually = Array.isArray(sensorDataEntry.data);
                
                // Show what keys exist in the sensorDataEntry
                debugInfo.sensorDataEntryKeys = Object.keys(sensorDataEntry);
                
                if (sensorDataEntry.data && sensorDataEntry.data.length > 0) {
                    // Find the first non-null entry
                    let firstValidEntry = null;
                    let firstValidIndex = -1;
                    
                    for (let i = 0; i < Math.min(10, sensorDataEntry.data.length); i++) {
                        if (sensorDataEntry.data[i] && typeof sensorDataEntry.data[i] === 'object') {
                            firstValidEntry = sensorDataEntry.data[i];
                            firstValidIndex = i;
                            break;
                        }
                    }
                    
                    debugInfo.sampleDataEntry = firstValidEntry;
                    debugInfo.firstValidEntryIndex = firstValidIndex;
                    debugInfo.totalDataEntries = sensorDataEntry.data.length;
                    
                    if (firstValidEntry) {
                        // Check what fields are available
                        const fields = Object.keys(firstValidEntry);
                        debugInfo.dataFieldsFound = fields;
                        
                        // Check for biomarker fields specifically
                        debugInfo.biomarkerFields = {
                            hasGlucose1: 'glucose1' in firstValidEntry,
                            hasGlucose2: 'glucose2' in firstValidEntry,
                            hasCortisol1: 'cortisol1' in firstValidEntry,
                            hasCortisol2: 'cortisol2' in firstValidEntry
                        };
                        
                        // Show sample values
                        debugInfo.sampleValues = {
                            glucose1: firstValidEntry.glucose1,
                            glucose2: firstValidEntry.glucose2,
                            cortisol1: firstValidEntry.cortisol1,
                            cortisol2: firstValidEntry.cortisol2,
                            timestamp: firstValidEntry.timestamp || firstValidEntry.dateTime
                        };
                    } else {
                        debugInfo.issue = "All entries in data array are null or invalid";
                        debugInfo.firstFewEntries = sensorDataEntry.data.slice(0, 5);
                    }
                } else {
                    debugInfo.issue = "Data array is empty or doesn't exist";
                    if (sensorDataEntry.data) {
                        debugInfo.actualDataContent = sensorDataEntry.data;
                    }
                    // Check if there are other potential data fields
                    const otherFields = Object.keys(sensorDataEntry).filter(key => 
                        key !== '_id' && key !== 'etag' && key !== 'username' && 
                        key !== 'processed_at' && key !== 'data'
                    );
                    debugInfo.otherPossibleDataFields = otherFields;
                    if (otherFields.length > 0) {
                        debugInfo.otherFieldsContent = {};
                        otherFields.forEach(field => {
                            debugInfo.otherFieldsContent[field] = sensorDataEntry[field];
                        });
                    }
                }
            }
        }

        res.json(debugInfo);
    } catch (error) {
        console.error('Error in debug endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch debug data' });
    }
});

// AGP Comparison endpoint for admins
app.get('/agp-comparison/:username1/:username2/:biomarkerType', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.admin) {
            return res.status(403).json({ error: 'Only administrators can compare AGP reports' });
        }

        const { username1, username2, biomarkerType } = req.params;
        
        if (!['glucose', 'cortisol'].includes(biomarkerType)) {
            return res.status(400).json({ error: 'Invalid biomarker type. Must be glucose or cortisol' });
        }

        // Fetch AGP data for both users
        const agpResults = await Promise.all([
            fetchUserAGPData(username1, biomarkerType),
            fetchUserAGPData(username2, biomarkerType)
        ]);

        res.json({
            patient1: {
                username: username1,
                data: agpResults[0]
            },
            patient2: {
                username: username2,
                data: agpResults[1]
            },
            biomarkerType,
            comparedAt: new Date()
        });

    } catch (error) {
        console.error('Error fetching AGP comparison data:', error);
        res.status(500).json({ error: 'Failed to fetch AGP comparison data' });
    }
});

// Helper function to fetch AGP data for a single user
async function fetchUserAGPData(username, biomarkerType) {
    try {
        console.log(`Fetching AGP data for user: ${username}, biomarker: ${biomarkerType}`);
        const db = client.db('s3-mongodb-db');
        const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
        const dataEntriesCollection = db.collection('s3-mongodb-data-entries');

        // Get user file info
        const userFileInfo = await fileTrackerCollection.findOne({ username: username });
        console.log(`User file info for ${username}:`, userFileInfo ? 'Found' : 'Not found');
        if (!userFileInfo) {
            return { error: `User ${username} not found in file tracker` };
        }
        if (!userFileInfo.etag) {
            return { error: `User ${username} has no etag (no processed data)` };
        }

        // Get sensor data
        console.log(`Looking for sensor data with etag: ${userFileInfo.etag}`);
        const sensorDataEntry = await dataEntriesCollection.findOne({ etag: userFileInfo.etag });
        console.log(`Sensor data entry for ${username}:`, sensorDataEntry ? 'Found' : 'Not found');
        if (!sensorDataEntry) {
            return { error: `No sensor data entry found for user ${username} with etag ${userFileInfo.etag}` };
        }
        if (!sensorDataEntry.data) {
            return { error: `Sensor data entry exists for user ${username} but contains no data` };
        }

        let sensorData = [];
        
        // Handle different data structures
        if (Array.isArray(sensorDataEntry.data)) {
            // Old format: data is directly an array
            sensorData = sensorDataEntry.data;
            console.log(`Using old format - sensor data array length for ${username}: ${sensorData.length}`);
        } else if (sensorDataEntry.data.data_points && Array.isArray(sensorDataEntry.data.data_points)) {
            // New format: data is an object with data_points array
            sensorData = sensorDataEntry.data.data_points;
            console.log(`Using new format - sensor data array length for ${username}: ${sensorData.length}`);
        } else {
            return { error: `Sensor data for user ${username} is neither an array nor has data_points array. Structure: ${JSON.stringify(Object.keys(sensorDataEntry.data))}` };
        }

        let biomarkerData = [];

        // Sample first few entries to see data structure
        if (sensorData.length > 0) {
            console.log(`Sample data entry for ${username}:`, JSON.stringify(sensorData[0], null, 2));
        }

        // Extract biomarker data based on type
        sensorData.forEach((entry, index) => {
            if (biomarkerType === 'glucose') {
                // Handle both old and new field names
                const glucose1 = entry.glucose1 || entry['Glucose(mg/dL)'];
                const glucose2 = entry.glucose2 || entry['Glucose(mg/dL)_2'];
                
                if (glucose1 && !isNaN(parseFloat(glucose1))) {
                    biomarkerData.push({
                        timestamp: entry.timestamp || entry.dateTime,
                        value: parseFloat(glucose1),
                        sensor: 1
                    });
                }
                if (glucose2 && !isNaN(parseFloat(glucose2))) {
                    biomarkerData.push({
                        timestamp: entry.timestamp || entry.dateTime,
                        value: parseFloat(glucose2),
                        sensor: 2
                    });
                }
            } else if (biomarkerType === 'cortisol') {
                // Handle both old and new field names
                const cortisol1 = entry.cortisol1 || entry['Cortisol(ng/mL)'];
                const cortisol2 = entry.cortisol2 || entry['Cortisol(ng/mL)_2'];
                
                if (cortisol1 && !isNaN(parseFloat(cortisol1))) {
                    biomarkerData.push({
                        timestamp: entry.timestamp || entry.dateTime,
                        value: parseFloat(cortisol1),
                        sensor: 1
                    });
                }
                if (cortisol2 && !isNaN(parseFloat(cortisol2))) {
                    biomarkerData.push({
                        timestamp: entry.timestamp || entry.dateTime,
                        value: parseFloat(cortisol2),
                        sensor: 2
                    });
                }
            }
        });

        console.log(`Extracted ${biomarkerData.length} ${biomarkerType} readings for user ${username}`);
        if (biomarkerData.length === 0) {
            return { error: `No ${biomarkerType} data found for user ${username}. Check if the data contains ${biomarkerType}1 or ${biomarkerType}2 fields.` };
        }

        // Get applicable ranges for this user
        let customRanges = null;
        try {
            const configCollection = db.collection('biomarker_configs');
            const configDoc = await configCollection.findOne({ type: 'biomarker_ranges' });
            
            console.log(`=== DEBUGGING CUSTOM RANGES for ${username} ===`);
            console.log('Config document exists:', !!configDoc);
            console.log('Biomarker type:', biomarkerType);
            console.log('User personal info exists:', !!userFileInfo.personal_information);
            if (userFileInfo.personal_information) {
                console.log('Personal info keys:', Object.keys(userFileInfo.personal_information));
                console.log('Personal info values:', userFileInfo.personal_information);
            }
            
            if (configDoc && configDoc.configs[biomarkerType] && userFileInfo.personal_information) {
                const personalInfo = userFileInfo.personal_information;
                const deviceInfo = userFileInfo.device_info;
                const applicableConditions = [];

                // Check for applicable conditions
                if (personalInfo.pregnant === true) applicableConditions.push('pregnancy');
                if (personalInfo.Diabete === true || personalInfo.diabete === true || personalInfo.diabetes === true) {
                    applicableConditions.push('type2_diabetes');
                }
                if (personalInfo.smokes === true) applicableConditions.push('smoking');
                if (personalInfo.drinks === true) applicableConditions.push('drinking');
                if (personalInfo['High BP'] === true || personalInfo.hypertension === true) {
                    applicableConditions.push('hypertension');
                }
                
                const age = deviceInfo?.age || personalInfo.age;
                if (age && (parseInt(age) < 18 || age < 18)) {
                    applicableConditions.push('pediatric');
                }

                console.log('Applicable conditions found:', applicableConditions);
                
                // Get custom ranges if conditions apply
                if (applicableConditions.length > 0) {
                    const biomarkerConfig = configDoc.configs[biomarkerType];
                    const applicableRanges = [];
                    
                    console.log('Available conditions in config:', Object.keys(biomarkerConfig.conditions || {}));
                    
                    for (const condition of applicableConditions) {
                        if (biomarkerConfig.conditions[condition]) {
                            console.log(`Found config for condition: ${condition}`);
                            applicableRanges.push(biomarkerConfig.conditions[condition].ranges);
                        } else {
                            console.log(`No config found for condition: ${condition}`);
                        }
                    }
                    
                    if (applicableRanges.length > 0) {
                        if (applicableRanges.length === 1) {
                            customRanges = applicableRanges[0];
                        } else {
                            // Average the ranges across multiple conditions
                            customRanges = averageRanges(applicableRanges, biomarkerType);
                        }
                        console.log('Final custom ranges applied:', customRanges);
                    } else {
                        console.log('No applicable ranges found despite having conditions');
                    }
                } else {
                    console.log('No applicable conditions detected');
                }
            }
        } catch (error) {
            console.log('Could not fetch custom ranges, using defaults:', error.message);
        }

        // Calculate statistics with custom ranges
        const statistics = biomarkerType === 'glucose' 
            ? calculateAGPStatistics(biomarkerData, customRanges)
            : calculateCortisolStatistics(biomarkerData, customRanges);

        // Calculate hourly percentiles for AGP chart
        const hourlyData = Array(24).fill(null).map(() => []);
        
        biomarkerData.forEach(point => {
            const date = new Date(point.timestamp);
            if (!isNaN(date.getTime())) {
                const hour = date.getHours();
                hourlyData[hour].push(point.value);
            }
        });

        const percentiles = {
            percentile_5: [],
            percentile_25: [],
            percentile_50: [],
            percentile_75: [],
            percentile_95: []
        };

        hourlyData.forEach(hourData => {
            if (hourData.length > 0) {
                hourData.sort((a, b) => a - b);
                const getPercentile = (arr, p) => {
                    const index = (p / 100) * (arr.length - 1);
                    if (Number.isInteger(index)) {
                        return arr[index];
                    } else {
                        const lower = Math.floor(index);
                        const upper = Math.ceil(index);
                        const weight = index - lower;
                        return arr[lower] * (1 - weight) + arr[upper] * weight;
                    }
                };

                percentiles.percentile_5.push(getPercentile(hourData, 5));
                percentiles.percentile_25.push(getPercentile(hourData, 25));
                percentiles.percentile_50.push(getPercentile(hourData, 50));
                percentiles.percentile_75.push(getPercentile(hourData, 75));
                percentiles.percentile_95.push(getPercentile(hourData, 95));
            } else {
                // No data for this hour
                percentiles.percentile_5.push(null);
                percentiles.percentile_25.push(null);
                percentiles.percentile_50.push(null);
                percentiles.percentile_75.push(null);
                percentiles.percentile_95.push(null);
            }
        });

        return {
            username,
            device_info: userFileInfo.device_info,
            statistics,
            percentiles,
            totalReadings: biomarkerData.length,
            dataRange: {
                start: new Date(Math.min(...biomarkerData.map(d => new Date(d.timestamp)))),
                end: new Date(Math.max(...biomarkerData.map(d => new Date(d.timestamp))))
            }
        };

    } catch (error) {
        console.error(`Error fetching AGP data for ${username}:`, error);
        return { error: `Failed to fetch data for user ${username}` };
    }
}

// Admin Biomarker Configuration Endpoints
// GET /admin/auth-test - Test admin authentication
app.get('/admin/auth-test', authenticateToken, async (req, res) => {
    try {
        console.log('Auth test request from:', req.user.username, 'Admin:', req.user.admin);
        res.json({
            username: req.user.username,
            isAdmin: req.user.admin,
            message: req.user.admin ? 'Admin access confirmed' : 'Not an admin user'
        });
    } catch (error) {
        console.error('Auth test error:', error);
        res.status(500).json({ error: 'Authentication test failed' });
    }
});

// GET /admin/biomarker-configs - Get current biomarker range configurations
app.get('/admin/biomarker-configs', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.admin) {
            return res.status(403).json({ error: 'Only administrators can access biomarker configurations' });
        }

        const db = client.db('s3-mongodb-db');
        const configCollection = db.collection('biomarker_configs');
        
        // Get the current configuration or return defaults
        let config = await configCollection.findOne({ type: 'biomarker_ranges' });
        
        if (!config) {
            // Return default configuration if none exists
            config = {
                type: 'biomarker_ranges',
                configs: {
                    glucose: {
                        default: {
                            veryLow: { min: 0, max: 54 },
                            low: { min: 54, max: 70 },
                            target: { min: 70, max: 180 },
                            high: { min: 180, max: 250 },
                            veryHigh: { min: 250, max: 400 }
                        },
                        conditions: {}
                    },
                    cortisol: {
                        default: {
                            veryLow: { min: 0, max: 5 },
                            low: { min: 5, max: 10 },
                            normal: { min: 10, max: 30 },
                            high: { min: 30, max: 50 },
                            veryHigh: { min: 50, max: 100 }
                        },
                        conditions: {}
                    }
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        res.json({ configs: config.configs });

    } catch (error) {
        console.error('Error fetching biomarker configurations:', error);
        res.status(500).json({ error: 'Failed to fetch biomarker configurations' });
    }
});

// POST /admin/biomarker-configs - Save biomarker range configurations
app.post('/admin/biomarker-configs', authenticateToken, async (req, res) => {
    try {
        console.log('Save request from user:', req.user.username, 'Admin status:', req.user.admin);
        console.log('Request body size:', JSON.stringify(req.body).length);
        
        // Check if user is admin
        if (!req.user.admin) {
            console.log('Access denied - user is not admin');
            return res.status(403).json({ error: 'Only administrators can modify biomarker configurations' });
        }

        const { configs } = req.body;
        
        if (!configs) {
            console.log('No configs in request body');
            return res.status(400).json({ error: 'Configurations data is required' });
        }
        
        console.log('Configs structure:', Object.keys(configs));
        console.log('Glucose config exists:', !!configs.glucose);
        console.log('Cortisol config exists:', !!configs.cortisol);

        const db = client.db('s3-mongodb-db');
        const configCollection = db.collection('biomarker_configs');
        
        console.log('Attempting to save to MongoDB...');
        
        // Upsert the configuration
        const result = await configCollection.updateOne(
            { type: 'biomarker_ranges' },
            {
                $set: {
                    configs: configs,
                    updatedAt: new Date(),
                    updatedBy: req.user.username
                },
                $setOnInsert: {
                    type: 'biomarker_ranges',
                    createdAt: new Date(),
                    createdBy: req.user.username
                }
            },
            { upsert: true }
        );

        console.log('Biomarker configuration saved by admin:', req.user.username);
        res.json({ 
            success: true, 
            message: 'Biomarker configurations saved successfully',
            modified: result.modifiedCount,
            upserted: result.upsertedCount
        });

    } catch (error) {
        console.error('Error saving biomarker configurations:', error);
        res.status(500).json({ error: 'Failed to save biomarker configurations' });
    }
});

// GET /admin/biomarker-configs/:biomarker - Get specific range configuration for AGP reports (default condition)
app.get('/admin/biomarker-configs/:biomarker', authenticateToken, async (req, res) => {
    try {
        const { biomarker } = req.params;
        const condition = 'default';
        
        if (!['glucose', 'cortisol'].includes(biomarker)) {
            return res.status(400).json({ error: 'Invalid biomarker type' });
        }

        const db = client.db('s3-mongodb-db');
        const configCollection = db.collection('biomarker_configs');
        
        const config = await configCollection.findOne({ type: 'biomarker_ranges' });
        
        if (!config || !config.configs[biomarker]) {
            // Return default ranges if no custom configuration exists
            const defaultRanges = {
                glucose: {
                    veryLow: { min: 0, max: 54 },
                    low: { min: 54, max: 70 },
                    target: { min: 70, max: 180 },
                    high: { min: 180, max: 250 },
                    veryHigh: { min: 250, max: 400 }
                },
                cortisol: {
                    veryLow: { min: 0, max: 5 },
                    low: { min: 5, max: 10 },
                    normal: { min: 10, max: 30 },
                    high: { min: 30, max: 50 },
                    veryHigh: { min: 50, max: 100 }
                }
            };
            
            return res.json({ ranges: defaultRanges[biomarker] });
        }

        // Get the specific condition ranges or default
        let ranges;
        if (condition === 'default') {
            ranges = config.configs[biomarker].default;
        } else {
            ranges = config.configs[biomarker].conditions[condition]?.ranges || config.configs[biomarker].default;
        }

        res.json({ ranges });

    } catch (error) {
        console.error('Error fetching specific biomarker configuration:', error);
        res.status(500).json({ error: 'Failed to fetch biomarker configuration' });
    }
});

// GET /admin/biomarker-configs/:biomarker/:condition - Get specific range configuration for AGP reports (specific condition)
app.get('/admin/biomarker-configs/:biomarker/:condition', authenticateToken, async (req, res) => {
    try {
        const { biomarker, condition } = req.params;
        
        if (!['glucose', 'cortisol'].includes(biomarker)) {
            return res.status(400).json({ error: 'Invalid biomarker type' });
        }

        const db = client.db('s3-mongodb-db');
        const configCollection = db.collection('biomarker_configs');
        
        const config = await configCollection.findOne({ type: 'biomarker_ranges' });
        
        if (!config || !config.configs[biomarker]) {
            // Return default ranges if no custom configuration exists
            const defaultRanges = {
                glucose: {
                    veryLow: { min: 0, max: 54 },
                    low: { min: 54, max: 70 },
                    target: { min: 70, max: 180 },
                    high: { min: 180, max: 250 },
                    veryHigh: { min: 250, max: 400 }
                },
                cortisol: {
                    veryLow: { min: 0, max: 5 },
                    low: { min: 5, max: 10 },
                    normal: { min: 10, max: 30 },
                    high: { min: 30, max: 50 },
                    veryHigh: { min: 50, max: 100 }
                }
            };
            
            return res.json({ ranges: defaultRanges[biomarker] });
        }

        // Get the specific condition ranges or default
        let ranges;
        if (condition === 'default') {
            ranges = config.configs[biomarker].default;
        } else {
            ranges = config.configs[biomarker].conditions[condition]?.ranges || config.configs[biomarker].default;
        }

        res.json({ ranges });

    } catch (error) {
        console.error('Error fetching specific biomarker configuration:', error);
        res.status(500).json({ error: 'Failed to fetch biomarker configuration' });
    }
});

// GET /user-applicable-ranges/:username/:biomarker - Get applicable biomarker ranges based on user's personal information
app.get('/user-applicable-ranges/:username/:biomarker', authenticateToken, async (req, res) => {
    try {
        const { username, biomarker } = req.params;
        
        // Check authorization
        if (!req.user.admin && 
            req.user.username !== username && 
            !req.user.patients?.includes(username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        const db = client.db('s3-mongodb-db');
        
        // Get user's personal information
        const userCollection = db.collection('s3-mongodb-data-entries');
        const userRecord = await userCollection.findOne(
            { username: username },
            { projection: { personal_information: 1, device_info: 1 } }
        );
        
        if (!userRecord || !userRecord.personal_information) {
            // Return default ranges if no personal information
            return res.json({
                applicableConditions: ['default'],
                personalInfo: null,
                ranges: null,
                useDefault: true
            });
        }

        // Map personal information fields to condition names
        const personalInfo = userRecord.personal_information;
        const deviceInfo = userRecord.device_info;
        const applicableConditions = [];

        // Check for applicable conditions based on personal information
        if (personalInfo.pregnant === true) {
            applicableConditions.push('pregnancy');
        }
        if (personalInfo.Diabete === true || personalInfo.diabete === true || personalInfo.diabetes === true) {
            // For now, default to type2_diabetes. Could be enhanced to differentiate
            applicableConditions.push('type2_diabetes');
        }
        if (personalInfo.smokes === true) {
            applicableConditions.push('smoking');
        }
        if (personalInfo.drinks === true) {
            applicableConditions.push('drinking');
        }
        if (personalInfo['High BP'] === true || personalInfo.hypertension === true) {
            applicableConditions.push('hypertension');
        }
        
        // Check age for pediatric condition
        const age = deviceInfo?.age || personalInfo.age;
        if (age && (parseInt(age) < 18 || age < 18)) {
            applicableConditions.push('pediatric');
        }

        // If no specific conditions apply, use default
        if (applicableConditions.length === 0) {
            return res.json({
                applicableConditions: ['default'],
                personalInfo: personalInfo,
                ranges: null,
                useDefault: true
            });
        }

        // Fetch configurations for applicable conditions from the new storage format
        const configCollection = db.collection('biomarker_configs');
        const configDoc = await configCollection.findOne({ type: 'biomarker_ranges' });

        if (!configDoc || !configDoc.configs[biomarker]) {
            return res.json({
                applicableConditions: applicableConditions,
                personalInfo: personalInfo,
                ranges: null,
                useDefault: true,
                message: `Conditions detected: ${applicableConditions.join(', ')}, but no custom ranges configured. Using default ranges.`
            });
        }

        const biomarkerConfig = configDoc.configs[biomarker];
        const applicableRanges = [];
        
        // Find ranges for applicable conditions
        for (const condition of applicableConditions) {
            if (biomarkerConfig.conditions[condition]) {
                applicableRanges.push({
                    condition: condition,
                    ranges: biomarkerConfig.conditions[condition].ranges,
                    name: biomarkerConfig.conditions[condition].name
                });
            }
        }

        // If no custom configs found, return default
        if (applicableRanges.length === 0) {
            return res.json({
                applicableConditions: applicableConditions,
                personalInfo: personalInfo,
                ranges: biomarkerConfig.default,
                useDefault: true,
                message: `Conditions detected: ${applicableConditions.join(', ')}, but no custom ranges configured. Using default ranges.`
            });
        }

        // Calculate average ranges if multiple conditions apply
        let finalRanges;
        let usedConditions;
        
        if (applicableRanges.length === 1) {
            finalRanges = applicableRanges[0].ranges;
            usedConditions = [applicableRanges[0].name];
        } else {
            // Average the ranges across multiple conditions
            finalRanges = averageRanges(applicableRanges.map(config => config.ranges), biomarker);
            usedConditions = applicableRanges.map(config => config.name);
        }

        res.json({
            applicableConditions: applicableConditions,
            personalInfo: personalInfo,
            ranges: finalRanges,
            useDefault: false,
            configsUsed: usedConditions,
            message: applicableRanges.length > 1 ? 
                `Multiple conditions detected (${usedConditions.join(', ')}). Using averaged ranges.` :
                `Condition detected: ${usedConditions[0]}. Using custom ranges.`
        });

    } catch (error) {
        console.error('Error fetching applicable ranges:', error);
        res.status(500).json({ error: 'Failed to fetch applicable ranges' });
    }
});

// Helper function to average ranges across multiple conditions
function averageRanges(rangesList, biomarker) {
    const rangeKeys = biomarker === 'glucose' 
        ? ['veryLow', 'low', 'target', 'high', 'veryHigh']
        : ['veryLow', 'low', 'normal', 'high', 'veryHigh'];
    
    const averagedRanges = {};
    
    rangeKeys.forEach(key => {
        const minValues = rangesList.map(ranges => ranges[key]?.min || 0).filter(val => val > 0);
        const maxValues = rangesList.map(ranges => ranges[key]?.max || 0).filter(val => val > 0);
        
        if (minValues.length > 0 && maxValues.length > 0) {
            averagedRanges[key] = {
                min: Math.round(minValues.reduce((sum, val) => sum + val, 0) / minValues.length),
                max: Math.round(maxValues.reduce((sum, val) => sum + val, 0) / maxValues.length)
            };
        }
    });
    
    return averagedRanges;
}

// Helper function to get users accessible to the current user
async function getAccessibleUsers(user) {
    try {
        const db = client.db('s3-mongodb-db');
        const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
        
        if (user.admin) {
            // Admin can access all users
            const allUsers = await fileTrackerCollection.distinct('username');
            return allUsers;
        } else if (user.doctor) {
            // Doctor can access patients assigned to them
            return user.patients || [];
        } else {
            // Regular user can only access their own data
            return [user.username];
        }
    } catch (error) {
        console.error('Error getting accessible users:', error);
        return [];
    }
}

// GET /aggregated-data/filter-options
// Returns available filter options (unique values for dropdowns)
app.get('/aggregated-data/filter-options', authenticateToken, async (req, res) => {
    try {
        // Get all users this user has access to
        const accessibleUsers = await getAccessibleUsers(req.user);
        
        if (accessibleUsers.length === 0) {
            return res.json({
                userIDs: [],
                deviceIDs: [],
                genders: [],
                arms: [],
                totalUsers: 0
            });
        }

        const db = client.db('s3-mongodb-db');
        const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
        
        // Aggregate unique filter values from all accessible user data
        const pipeline = [
            {
                $match: {
                    username: { $in: accessibleUsers }
                }
            },
            {
                $group: {
                    _id: null,
                    userIDs: { $addToSet: "$device_info.userID" },
                    deviceIDs: { $addToSet: "$device_info.deviceID" },
                    genders: { $addToSet: "$device_info.gender" },
                    arms: { $addToSet: "$device_info.arm" },
                    totalUsers: { $sum: 1 }
                }
            }
        ];
        
        const result = await fileTrackerCollection.aggregate(pipeline).toArray();
        
        if (result.length === 0) {
            return res.json({
                userIDs: [],
                deviceIDs: [],
                genders: [],
                arms: [],
                totalUsers: 0
            });
        }
        
        const options = result[0];
        
        res.json({
            userIDs: (options.userIDs || []).filter(Boolean).sort(),
            deviceIDs: (options.deviceIDs || []).filter(Boolean).sort(),
            genders: (options.genders || []).filter(Boolean).sort(),
            arms: (options.arms || []).filter(Boolean).sort(),
            totalUsers: options.totalUsers || 0
        });
        
    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({ error: 'Failed to fetch filter options' });
    }
});

// GET /aggregated-data/filtered
// Returns filtered sensor data based on query parameters
app.get('/aggregated-data/filtered', authenticateToken, async (req, res) => {
    try {
        console.log('=== DEBUG: Starting filtered data request ===');
        console.log('User:', req.user.username, 'Admin:', req.user.admin, 'Patients:', req.user.patients);
        console.log('Query params:', req.query);
        
        // Get users accessible to this user (using same logic as filetracker endpoint)
        const allData = await getFileTrackerData();
        let filteredUsers;

        if (req.user.admin) {
            // Admins can see all data except their own profile
            filteredUsers = allData.filter(entry => entry.username !== req.user.username);
        } else if (req.user.doctor) {
            // Doctors can see their patients' data but not their own profile
            filteredUsers = allData.filter(entry => 
                entry.username !== req.user.username && 
                req.user.patients.includes(entry.username)
            );
        } else {
            // Patients can only see their own data
            filteredUsers = allData.filter(entry => 
                entry.username === req.user.username
            );
        }
        
        console.log('Accessible users count:', filteredUsers.length);
        
        if (filteredUsers.length === 0) {
            return res.json({
                data: [],
                uniqueUsers: 0,
                totalRecords: 0
            });
        }

        // Parse query parameters for filtering
        const {
            userIDs,
            deviceIDs,
            genders,
            ageMin,
            ageMax,
            arms,
            startDate,
            endDate
        } = req.query;
        
        // Apply device info filters to users
        let usersAfterFiltering = filteredUsers;
        
        if (userIDs) {
            const userIDArray = userIDs.split(',');
            usersAfterFiltering = usersAfterFiltering.filter(user => 
                user.device_info && userIDArray.includes(user.device_info.userID)
            );
        }
        
        if (deviceIDs) {
            const deviceIDArray = deviceIDs.split(',');
            usersAfterFiltering = usersAfterFiltering.filter(user => 
                user.device_info && deviceIDArray.includes(user.device_info.deviceID)
            );
        }
        
        if (genders) {
            const genderArray = genders.split(',');
            usersAfterFiltering = usersAfterFiltering.filter(user => 
                user.device_info && genderArray.includes(user.device_info.gender)
            );
        }
        
        if (arms) {
            const armArray = arms.split(',');
            usersAfterFiltering = usersAfterFiltering.filter(user => 
                user.device_info && armArray.includes(user.device_info.arm)
            );
        }
        
        if (ageMin || ageMax) {
            usersAfterFiltering = usersAfterFiltering.filter(user => {
                if (!user.device_info || !user.device_info.age) return false;
                
                const age = typeof user.device_info.age === 'object' ? 
                    user.device_info.age.$numberInt : user.device_info.age;
                const ageNum = parseInt(age);
                
                if (isNaN(ageNum)) return false;
                
                const minAge = ageMin ? parseInt(ageMin) : 0;
                const maxAge = ageMax ? parseInt(ageMax) : 999;
                
                return ageNum >= minAge && ageNum <= maxAge;
            });
        }
        
        console.log('Users after filtering:', usersAfterFiltering.length);
        
        // Now get sensor data for each filtered user
        const db = client.db('s3-mongodb-db');
        const dataCollection = db.collection('s3-mongodb-data-entries');
        
        const allSensorData = [];
        
        for (const userInfo of usersAfterFiltering) {
            try {
                if (userInfo.etag) {
                    console.log('Fetching sensor data for etag:', userInfo.etag);
                    const sensorDataResponse = await dataCollection.findOne({ etag: userInfo.etag });
                    
                    if (sensorDataResponse) {
                        // Extract data points (handle both data structures)
                        let dataPoints = [];
                        if (sensorDataResponse.data && sensorDataResponse.data.data_points) {
                            dataPoints = sensorDataResponse.data.data_points;
                        } else if (sensorDataResponse.data_snapshot && sensorDataResponse.data_snapshot.data_points) {
                            dataPoints = sensorDataResponse.data_snapshot.data_points;
                        }
                        
                        console.log(`Found ${dataPoints.length} data points for user ${userInfo.username}`);
                        
                        // Process each data point
                        dataPoints.forEach(point => {
                            // Parse timestamp
                            let timestamp;
                            try {
                                if (point.timestamp && point.timestamp.$date && point.timestamp.$date.$numberLong) {
                                    timestamp = new Date(parseInt(point.timestamp.$date.$numberLong));
                                } else if (point.timestamp && point.timestamp.$date) {
                                    timestamp = new Date(point.timestamp.$date);
                                } else if (point.timestamp) {
                                    timestamp = new Date(point.timestamp);
                                } else if (point.time) {
                                    const timeValue = point.time.$numberInt || point.time;
                                    timestamp = new Date(parseInt(timeValue) * 1000);
                                } else {
                                    timestamp = new Date();
                                }
                            } catch (error) {
                                timestamp = new Date();
                            }
                            
                            // Apply date range filter
                            if (startDate || endDate) {
                                const startDateTime = startDate ? new Date(startDate) : new Date('1900-01-01');
                                const endDateTime = endDate ? new Date(endDate + 'T23:59:59') : new Date('2099-12-31');
                                
                                if (timestamp < startDateTime || timestamp > endDateTime) {
                                    return; // Skip this data point
                                }
                            }

                            // Extract sensor values and create data entries
                            const baseEntry = {
                                username: userInfo.username,
                                userID: userInfo.device_info ? userInfo.device_info.userID : null,
                                deviceID: userInfo.device_info ? userInfo.device_info.deviceID : null,
                                gender: userInfo.device_info ? userInfo.device_info.gender : null,
                                age: userInfo.device_info ? (userInfo.device_info.age.$numberInt || userInfo.device_info.age) : null,
                                arm: userInfo.device_info ? userInfo.device_info.arm : null,
                                timestamp: timestamp
                            };

                            // Add cortisol readings
                            const cortisol1 = point['Cortisol(ng/mL)'] && (point['Cortisol(ng/mL)'].$numberDouble || point['Cortisol(ng/mL)']);
                            const cortisol2 = point['Cortisol(ng/mL)_2'] && (point['Cortisol(ng/mL)_2'].$numberDouble || point['Cortisol(ng/mL)_2']);
                            
                            if (cortisol1 !== null && cortisol1 !== undefined && !isNaN(cortisol1)) {
                                allSensorData.push({
                                    ...baseEntry,
                                    biomarkerType: 'cortisol',
                                    value: parseFloat(cortisol1),
                                    sensor: 1
                                });
                            }
                            if (cortisol2 !== null && cortisol2 !== undefined && !isNaN(cortisol2)) {
                                allSensorData.push({
                                    ...baseEntry,
                                    biomarkerType: 'cortisol',
                                    value: parseFloat(cortisol2),
                                    sensor: 2
                                });
                            }

                            // Add glucose readings
                            const glucose1 = point['Glucose(mg/dL)'] && (point['Glucose(mg/dL)'].$numberDouble || point['Glucose(mg/dL)']);
                            const glucose2 = point['Glucose(mg/dL)_2'] && (point['Glucose(mg/dL)_2'].$numberDouble || point['Glucose(mg/dL)_2']);
                            
                            if (glucose1 !== null && glucose1 !== undefined && !isNaN(glucose1)) {
                                allSensorData.push({
                                    ...baseEntry,
                                    biomarkerType: 'glucose',
                                    value: parseFloat(glucose1),
                                    sensor: 1
                                });
                            }
                            if (glucose2 !== null && glucose2 !== undefined && !isNaN(glucose2)) {
                                allSensorData.push({
                                    ...baseEntry,
                                    biomarkerType: 'glucose',
                                    value: parseFloat(glucose2),
                                    sensor: 2
                                });
                            }
                        });
                    }
                }
            } catch (userError) {
                console.warn(`Could not fetch data for user ${userInfo.username}:`, userError.message);
            }
        }
        
        // Sort by timestamp
        allSensorData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Count unique users in final data
        const uniqueUsers = new Set(allSensorData.map(item => item.username)).size;
        
        console.log('=== Final Results ===');
        console.log('Total sensor data points:', allSensorData.length);
        console.log('Unique users:', uniqueUsers);
        
        res.json({
            data: allSensorData,
            uniqueUsers: uniqueUsers,
            totalRecords: allSensorData.length
        });
        
    } catch (error) {
        console.error('=== ERROR in filtered data endpoint ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to fetch filtered data' });
    }
});



// Calculate cortisol statistics and percentiles for Chart.js component
function calculateCortisolStatistics(cortisolData, customRanges = null) {
    if (!cortisolData || cortisolData.length === 0) {
        return {
            statistics: {
                average: 0,
                percentBelow5: 0,
                percentBelow10: 0,
                percentBetween10And30: 0,
                percentAbove30: 0,
                percentAbove50: 0,
                coefficientOfVariationPercentage: 0
            },
            percentages: {
                percentile_5: Array(24).fill(0),
                percentile_25: Array(24).fill(0),
                percentile_50: Array(24).fill(0),
                percentile_75: Array(24).fill(0),
                percentile_95: Array(24).fill(0)
            },
            startAt: new Date().toISOString(),
            endAt: new Date().toISOString()
        };
    }

    const values = cortisolData.map(d => d.value);
    const sortedValues = values.sort((a, b) => a - b);
    
    // Calculate basic statistics
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / total) * 1000) / 1000; // Round to 3 decimal places for cortisol
    
    // Get range thresholds (custom or default)
    let veryLowMax, lowMax, normalMin, normalMax, highMax;
    
    if (customRanges) {
        veryLowMax = customRanges.veryLow?.max || 5;
        lowMax = customRanges.low?.max || 10;
        normalMin = customRanges.normal?.min || 10;
        normalMax = customRanges.normal?.max || 30;
        highMax = customRanges.high?.max || 50;
    } else {
        // Default cortisol ranges (0-20 ng/mL scale)
        veryLowMax = 2;
        lowMax = 5;
        normalMin = 5;
        normalMax = 15;
        highMax = 20;
    }
    
    // Debug logging for range verification
    console.log(`Cortisol Stats Calculation - Custom ranges provided: ${!!customRanges}`);
    if (customRanges) {
        console.log(`Using custom cortisol ranges: VeryLow<${veryLowMax}, Low<${lowMax}, Normal:${normalMin}-${normalMax}, High>${normalMax}, VeryHigh>${highMax}`);
    } else {
        console.log(`Using default cortisol ranges: VeryLow<${veryLowMax}, Low<${lowMax}, Normal:${normalMin}-${normalMax}, High>${normalMax}, VeryHigh>${highMax}`);
    }

    // Calculate actual time in ranges for cortisol (assuming 15-minute intervals)
    const readingIntervalMinutes = 15; // Standard sensor reading interval
    const totalWearTimeMinutes = total * readingIntervalMinutes;
    
    // Calculate time spent in each range
    const belowVeryLow = values.filter(v => v < veryLowMax).length;
    const belowLow = values.filter(v => v < lowMax).length;
    const inNormal = values.filter(v => v >= normalMin && v <= normalMax).length;
    const aboveNormal = values.filter(v => v > normalMax).length;
    const aboveHigh = values.filter(v => v > highMax).length;
    
    // Calculate actual time spent in each range (in minutes)
    const timeVeryLowMinutes = belowVeryLow * readingIntervalMinutes;
    const timeLowMinutes = (belowLow - belowVeryLow) * readingIntervalMinutes;
    const timeNormalMinutes = inNormal * readingIntervalMinutes;
    const timeHighMinutes = (aboveNormal - aboveHigh) * readingIntervalMinutes;
    const timeVeryHighMinutes = aboveHigh * readingIntervalMinutes;
    
    // Calculate percentages based on actual wear time
    const percentBelow5 = totalWearTimeMinutes > 0 ? Math.round((timeVeryLowMinutes / totalWearTimeMinutes) * 100) : 0;
    const percentBelow10 = totalWearTimeMinutes > 0 ? Math.round(((timeVeryLowMinutes + timeLowMinutes) / totalWearTimeMinutes) * 100) : 0;
    const percentBetween10And30 = totalWearTimeMinutes > 0 ? Math.round((timeNormalMinutes / totalWearTimeMinutes) * 100) : 0;
    const percentAbove30 = totalWearTimeMinutes > 0 ? Math.round(((timeHighMinutes + timeVeryHighMinutes) / totalWearTimeMinutes) * 100) : 0;
    const percentAbove50 = totalWearTimeMinutes > 0 ? Math.round((timeVeryHighMinutes / totalWearTimeMinutes) * 100) : 0;
    
    console.log(`Cortisol wear time: ${total} readings × ${readingIntervalMinutes} min = ${totalWearTimeMinutes} min (${Math.round(totalWearTimeMinutes/60*100)/100} hours)`);
    
    // Calculate coefficient of variation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / total;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariationPercentage = Math.round((standardDeviation / average) * 100);
    
    // Group data by hour for percentile calculations
    const hourlyData = Array(24).fill(null).map(() => []);
    
    cortisolData.forEach(point => {
        const hour = new Date(point.timestamp).getHours();
        hourlyData[hour].push(point.value);
    });
    
    // Calculate percentiles for each hour
    const percentile_5 = [];
    const percentile_25 = [];
    const percentile_50 = [];
    const percentile_75 = [];
    const percentile_95 = [];
    
    for (let hour = 0; hour < 24; hour++) {
        const hourValues = hourlyData[hour].sort((a, b) => a - b);
        
        if (hourValues.length === 0) {
            // Use overall average if no data for this hour
            percentile_5.push(average * 0.7);
            percentile_25.push(average * 0.85);
            percentile_50.push(average);
            percentile_75.push(average * 1.15);
            percentile_95.push(average * 1.3);
        } else {
            const getPercentile = (arr, p) => {
                const index = Math.ceil(arr.length * p / 100) - 1;
                return arr[Math.max(0, Math.min(index, arr.length - 1))];
            };
            
            percentile_5.push(getPercentile(hourValues, 5));
            percentile_25.push(getPercentile(hourValues, 25));
            percentile_50.push(getPercentile(hourValues, 50));
            percentile_75.push(getPercentile(hourValues, 75));
            percentile_95.push(getPercentile(hourValues, 95));
        }
    }
    
    // Get date range
    const timestamps = cortisolData.map(d => new Date(d.timestamp));
    const startAt = new Date(Math.min(...timestamps)).toISOString();
    const endAt = new Date(Math.max(...timestamps)).toISOString();
    
            return {
            statistics: {
                average,
                percentBelow5,
                percentBelow10,
                percentBetween10And30,
                percentAbove30,
                percentAbove50,
                coefficientOfVariationPercentage,
                // Add actual time information
                totalWearTimeMinutes,
                totalWearTimeHours: Math.round(totalWearTimeMinutes/60*100)/100,
                timeVeryLowMinutes,
                timeLowMinutes,
                timeNormalMinutes,
                timeHighMinutes,
                timeVeryHighMinutes
            },
            percentages: {
                percentile_5,
                percentile_25,
                percentile_50,
                percentile_75,
                percentile_95
            },
            startAt,
            endAt
        };
}

// Calculate AGP statistics and percentiles for Chart.js component
function calculateAGPStatistics(glucoseData, customRanges = null) {
    if (!glucoseData || glucoseData.length === 0) {
        return {
            statistics: {
                average: 0,
                percentBelow54: 0,
                percentBelow70: 0,
                percentBetween70And180: 0,
                percentAbove180: 0,
                percentAbove250: 0,
                a1c: 0,
                gmi: 0,
                coefficientOfVariationPercentage: 0
            },
            percentages: {
                percentile_5: Array(24).fill(0),
                percentile_25: Array(24).fill(0),
                percentile_50: Array(24).fill(0),
                percentile_75: Array(24).fill(0),
                percentile_95: Array(24).fill(0)
            },
            startAt: new Date().toISOString(),
            endAt: new Date().toISOString()
        };
    }

    const values = glucoseData.map(d => d.value);
    const sortedValues = values.sort((a, b) => a - b);
    
    // Calculate basic statistics
    const total = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / total);
    
    // Get range thresholds (custom or default)
    let veryLowMax, lowMax, targetMin, targetMax, highMax;
    
    if (customRanges) {
        veryLowMax = customRanges.veryLow?.max || 54;
        lowMax = customRanges.low?.max || 70;
        targetMin = customRanges.target?.min || 70;
        targetMax = customRanges.target?.max || 180;
        highMax = customRanges.high?.max || 250;
    } else {
        // Default glucose ranges
        veryLowMax = 54;
        lowMax = 70;
        targetMin = 70;
        targetMax = 180;
        highMax = 250;
    }
    
    // Debug logging for range verification
    console.log(`AGP Stats Calculation - Custom ranges provided: ${!!customRanges}`);
    if (customRanges) {
        console.log(`Using custom glucose ranges: VeryLow<${veryLowMax}, Low<${lowMax}, Target:${targetMin}-${targetMax}, High>${targetMax}, VeryHigh>${highMax}`);
    } else {
        console.log(`Using default glucose ranges: VeryLow<${veryLowMax}, Low<${lowMax}, Target:${targetMin}-${targetMax}, High>${targetMax}, VeryHigh>${highMax}`);
    }

    // Calculate actual time in ranges (assuming 15-minute intervals between readings)
    const readingIntervalMinutes = 15; // Standard CGM reading interval
    const totalWearTimeMinutes = total * readingIntervalMinutes;
    
    // Calculate time spent in each range
    const belowVeryLow = values.filter(v => v < veryLowMax).length;
    const belowLow = values.filter(v => v < lowMax).length;
    const inTarget = values.filter(v => v >= targetMin && v <= targetMax).length;
    const aboveTarget = values.filter(v => v > targetMax).length;
    const aboveHigh = values.filter(v => v > highMax).length;
    
    // Calculate actual time spent in each range (in minutes)
    const timeVeryLowMinutes = belowVeryLow * readingIntervalMinutes;
    const timeLowMinutes = (belowLow - belowVeryLow) * readingIntervalMinutes;
    const timeTargetMinutes = inTarget * readingIntervalMinutes;
    const timeHighMinutes = (aboveTarget - aboveHigh) * readingIntervalMinutes;
    const timeVeryHighMinutes = aboveHigh * readingIntervalMinutes;
    
    // Calculate percentages based on actual wear time
    const percentBelow54 = totalWearTimeMinutes > 0 ? Math.round((timeVeryLowMinutes / totalWearTimeMinutes) * 100) : 0;
    const percentBelow70 = totalWearTimeMinutes > 0 ? Math.round(((timeVeryLowMinutes + timeLowMinutes) / totalWearTimeMinutes) * 100) : 0;
    const percentBetween70And180 = totalWearTimeMinutes > 0 ? Math.round((timeTargetMinutes / totalWearTimeMinutes) * 100) : 0;
    const percentAbove180 = totalWearTimeMinutes > 0 ? Math.round(((timeHighMinutes + timeVeryHighMinutes) / totalWearTimeMinutes) * 100) : 0;
    const percentAbove250 = totalWearTimeMinutes > 0 ? Math.round((timeVeryHighMinutes / totalWearTimeMinutes) * 100) : 0;
    
    console.log(`Wear time calculation: ${total} readings × ${readingIntervalMinutes} min = ${totalWearTimeMinutes} min (${Math.round(totalWearTimeMinutes/60*100)/100} hours)`);
    console.log(`Time in target range: ${timeTargetMinutes} minutes (${Math.round(timeTargetMinutes/60*100)/100} hours) = ${percentBetween70And180}%`);
    
    // Calculate estimated A1C and GMI
    const gmi = Math.round(((average + 46.7) / 28.7) * 10) / 10;
    const a1c = gmi; // Simplified calculation
    
    // Calculate coefficient of variation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / total;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariationPercentage = Math.round((standardDeviation / average) * 100);
    
    // Group data by hour for percentile calculations
    const hourlyData = Array(24).fill(null).map(() => []);
    
    glucoseData.forEach(point => {
        const hour = new Date(point.timestamp).getHours();
        hourlyData[hour].push(point.value);
    });
    
    // Calculate percentiles for each hour
    const percentile_5 = [];
    const percentile_25 = [];
    const percentile_50 = [];
    const percentile_75 = [];
    const percentile_95 = [];
    
    for (let hour = 0; hour < 24; hour++) {
        const hourValues = hourlyData[hour].sort((a, b) => a - b);
        
        if (hourValues.length === 0) {
            // Use overall average if no data for this hour
            percentile_5.push(average * 0.7);
            percentile_25.push(average * 0.85);
            percentile_50.push(average);
            percentile_75.push(average * 1.15);
            percentile_95.push(average * 1.3);
        } else {
            const getPercentile = (arr, p) => {
                const index = Math.ceil(arr.length * p / 100) - 1;
                return arr[Math.max(0, Math.min(index, arr.length - 1))];
            };
            
            percentile_5.push(getPercentile(hourValues, 5));
            percentile_25.push(getPercentile(hourValues, 25));
            percentile_50.push(getPercentile(hourValues, 50));
            percentile_75.push(getPercentile(hourValues, 75));
            percentile_95.push(getPercentile(hourValues, 95));
        }
    }
    
    // Get date range
    const timestamps = glucoseData.map(d => new Date(d.timestamp));
    const startAt = new Date(Math.min(...timestamps)).toISOString();
    const endAt = new Date(Math.max(...timestamps)).toISOString();
    
    return {
        statistics: {
            average,
            percentBelow54,
            percentBelow70,
            percentBetween70And180,
            percentAbove180,
            percentAbove250,
            a1c,
            gmi,
            coefficientOfVariationPercentage,
            // Add actual time information
            totalWearTimeMinutes,
            totalWearTimeHours: Math.round(totalWearTimeMinutes/60*100)/100,
            timeVeryLowMinutes,
            timeLowMinutes,
            timeTargetMinutes,
            timeHighMinutes,
            timeVeryHighMinutes
        },
        percentages: {
            percentile_5,
            percentile_25,
            percentile_50,
            percentile_75,
            percentile_95
        },
        startAt,
        endAt
    };
}

// GET /user-glucose-agp/:username
// Returns glucose data for a specific user for AGP analysis
app.get('/user-glucose-agp/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        console.log('=== DEBUG: Starting user-specific AGP glucose data request ===');
        console.log('User:', req.user.username, 'Admin:', req.user.admin, 'Patients:', req.user.patients);
        console.log('Requested patient:', username);
        
        // Check authorization - same logic as other user-specific endpoints
        if (!req.user.admin && 
            req.user.username !== username && 
            !req.user.patients?.includes(username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        // Get specific user info
        const allData = await getFileTrackerData();
        const userInfo = allData.find(entry => entry.username === username);
        
        if (!userInfo) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log('Found user info for:', username);

        // Get glucose sensor data for this user
        const db = client.db('s3-mongodb-db');
        const dataCollection = db.collection('s3-mongodb-data-entries');
        
        const glucoseData = [];
        
        try {
            if (userInfo.etag) {
                console.log('Fetching glucose data for etag:', userInfo.etag);
                const sensorDataResponse = await dataCollection.findOne({ etag: userInfo.etag });
                
                if (sensorDataResponse) {
                    // Extract data points (handle both data structures)
                    let dataPoints = [];
                    if (sensorDataResponse.data && sensorDataResponse.data.data_points) {
                        dataPoints = sensorDataResponse.data.data_points;
                    } else if (sensorDataResponse.data_snapshot && sensorDataResponse.data_snapshot.data_points) {
                        dataPoints = sensorDataResponse.data_snapshot.data_points;
                    }
                    
                    console.log(`Found ${dataPoints.length} data points for user ${username}`);
                    
                    // Process each data point for glucose values only
                    dataPoints.forEach(point => {
                        // Parse timestamp
                        let timestamp;
                        try {
                            if (point.timestamp && point.timestamp.$date && point.timestamp.$date.$numberLong) {
                                timestamp = new Date(parseInt(point.timestamp.$date.$numberLong));
                            } else if (point.timestamp && point.timestamp.$date) {
                                timestamp = new Date(point.timestamp.$date);
                            } else if (point.timestamp) {
                                timestamp = new Date(point.timestamp);
                            } else if (point.time) {
                                const timeValue = point.time.$numberInt || point.time;
                                timestamp = new Date(parseInt(timeValue) * 1000);
                            } else {
                                timestamp = new Date();
                            }
                        } catch (error) {
                            timestamp = new Date();
                        }

                        // Extract glucose readings from both sensors
                        const glucose1 = point['Glucose(mg/dL)'] && (point['Glucose(mg/dL)'].$numberDouble || point['Glucose(mg/dL)']);
                        const glucose2 = point['Glucose(mg/dL)_2'] && (point['Glucose(mg/dL)_2'].$numberDouble || point['Glucose(mg/dL)_2']);
                        
                        // Calculate mean of the two glucose sensors if both are available
                        const validGlucose1 = (glucose1 !== null && glucose1 !== undefined && !isNaN(glucose1)) ? parseFloat(glucose1) : null;
                        const validGlucose2 = (glucose2 !== null && glucose2 !== undefined && !isNaN(glucose2)) ? parseFloat(glucose2) : null;
                        
                        let meanGlucose = null;
                        if (validGlucose1 !== null && validGlucose2 !== null) {
                            // Both sensors have data - calculate mean
                            meanGlucose = (validGlucose1 + validGlucose2) / 2;
                        } else if (validGlucose1 !== null) {
                            // Only sensor 1 has data
                            meanGlucose = validGlucose1;
                        } else if (validGlucose2 !== null) {
                            // Only sensor 2 has data
                            meanGlucose = validGlucose2;
                        }
                        
                        // Add the mean glucose value to the data if we have at least one valid reading
                        if (meanGlucose !== null) {
                            glucoseData.push({
                                username: username,
                                userID: userInfo.device_info ? userInfo.device_info.userID : null,
                                deviceID: userInfo.device_info ? userInfo.device_info.deviceID : null,
                                timestamp: timestamp,
                                value: meanGlucose,
                                sensor: 'mean', // Indicate this is the mean of both sensors
                                glucose1: validGlucose1, // Keep original values for reference
                                glucose2: validGlucose2
                            });
                        }
                    });
                }
            }
        } catch (userError) {
            console.warn(`Could not fetch glucose data for user ${username}:`, userError.message);
        }
        
        // Sort by timestamp
        glucoseData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        console.log('=== User AGP Final Results ===');
        console.log('Total glucose data points for', username, ':', glucoseData.length);
        
        // Get applicable ranges for this user
        let customRanges = null;
        try {
            const configCollection = db.collection('biomarker_configs');
            const configDoc = await configCollection.findOne({ type: 'biomarker_ranges' });
            
            if (configDoc && configDoc.configs.glucose && userInfo.personal_information) {
                const personalInfo = userInfo.personal_information;
                const deviceInfo = userInfo.device_info;
                const applicableConditions = [];

                // Check for applicable conditions
                if (personalInfo.pregnant === true) applicableConditions.push('pregnancy');
                if (personalInfo.Diabete === true || personalInfo.diabete === true || personalInfo.diabetes === true) {
                    applicableConditions.push('type2_diabetes');
                }
                if (personalInfo.smokes === true) applicableConditions.push('smoking');
                if (personalInfo.drinks === true) applicableConditions.push('drinking');
                if (personalInfo['High BP'] === true || personalInfo.hypertension === true) {
                    applicableConditions.push('hypertension');
                }
                
                const age = deviceInfo?.age || personalInfo.age;
                if (age && (parseInt(age) < 18 || age < 18)) {
                    applicableConditions.push('pediatric');
                }

                // Get custom ranges if conditions apply
                if (applicableConditions.length > 0) {
                    const biomarkerConfig = configDoc.configs.glucose;
                    const applicableRanges = [];
                    
                    for (const condition of applicableConditions) {
                        if (biomarkerConfig.conditions[condition]) {
                            applicableRanges.push(biomarkerConfig.conditions[condition].ranges);
                        }
                    }
                    
                    if (applicableRanges.length > 0) {
                        if (applicableRanges.length === 1) {
                            customRanges = applicableRanges[0];
                        } else {
                            // Average the ranges across multiple conditions
                            customRanges = averageRanges(applicableRanges, 'glucose');
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Could not fetch custom ranges for glucose AGP, using defaults:', error.message);
        }

        // Calculate AGP statistics and percentiles
        const agpResult = calculateAGPStatistics(glucoseData, customRanges);
        
        res.json({
            ...agpResult,
            patientInfo: {
                name: username,
                userID: userInfo.device_info?.userID,
                deviceID: userInfo.device_info?.deviceID,
                gender: userInfo.device_info?.gender || 'Unknown',
                age: userInfo.device_info?.age || 'Unknown',
                device: userInfo.device_info?.deviceID || 'CGM Device'
            }
        });
        
    } catch (error) {
        console.error('=== ERROR in user-specific AGP glucose data endpoint ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to fetch glucose data for AGP analysis' });
    }
});

// GET /user-cortisol-agp/:username
// Returns cortisol data for a specific user for AGP-style analysis
app.get('/user-cortisol-agp/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        console.log('=== DEBUG: Starting user-specific cortisol AGP data request ===');
        console.log('User:', req.user.username, 'Admin:', req.user.admin, 'Patients:', req.user.patients);
        console.log('Requested patient:', username);
        
        // Check authorization - same logic as other user-specific endpoints
        if (!req.user.admin && 
            req.user.username !== username && 
            !req.user.patients?.includes(username)) {
            return res.status(403).json({ error: 'Not authorized to view this data' });
        }

        // Get specific user info
        const allData = await getFileTrackerData();
        const userInfo = allData.find(entry => entry.username === username);
        
        if (!userInfo) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log('Found user info for:', username);

        // Get cortisol sensor data for this user
        const db = client.db('s3-mongodb-db');
        const dataCollection = db.collection('s3-mongodb-data-entries');
        
        const cortisolData = [];
        
        try {
            if (userInfo.etag) {
                console.log('Fetching cortisol data for etag:', userInfo.etag);
                const sensorDataResponse = await dataCollection.findOne({ etag: userInfo.etag });
                
                if (sensorDataResponse) {
                    // Extract data points (handle both data structures)
                    let dataPoints = [];
                    if (sensorDataResponse.data && sensorDataResponse.data.data_points) {
                        dataPoints = sensorDataResponse.data.data_points;
                    } else if (sensorDataResponse.data_snapshot && sensorDataResponse.data_snapshot.data_points) {
                        dataPoints = sensorDataResponse.data_snapshot.data_points;
                    }
                    
                    console.log(`Found ${dataPoints.length} data points for user ${username}`);
                    
                    // Process each data point for cortisol values only
                    dataPoints.forEach(point => {
                        // Parse timestamp
                        let timestamp;
                        try {
                            if (point.timestamp && point.timestamp.$date && point.timestamp.$date.$numberLong) {
                                timestamp = new Date(parseInt(point.timestamp.$date.$numberLong));
                            } else if (point.timestamp && point.timestamp.$date) {
                                timestamp = new Date(point.timestamp.$date);
                            } else if (point.timestamp) {
                                timestamp = new Date(point.timestamp);
                            } else if (point.time) {
                                const timeValue = point.time.$numberInt || point.time;
                                timestamp = new Date(parseInt(timeValue) * 1000);
                            } else {
                                timestamp = new Date();
                            }
                        } catch (error) {
                            timestamp = new Date();
                        }

                        // Extract cortisol readings from both sensors
                        const cortisol1 = point['Cortisol(ng/mL)'] && (point['Cortisol(ng/mL)'].$numberDouble || point['Cortisol(ng/mL)']);
                        const cortisol2 = point['Cortisol(ng/mL)_2'] && (point['Cortisol(ng/mL)_2'].$numberDouble || point['Cortisol(ng/mL)_2']);
                        
                        // Calculate mean of the two cortisol sensors if both are available
                        const validCortisol1 = (cortisol1 !== null && cortisol1 !== undefined && !isNaN(cortisol1)) ? parseFloat(cortisol1) : null;
                        const validCortisol2 = (cortisol2 !== null && cortisol2 !== undefined && !isNaN(cortisol2)) ? parseFloat(cortisol2) : null;
                        
                        let meanCortisol = null;
                        if (validCortisol1 !== null && validCortisol2 !== null) {
                            // Both sensors have data - calculate mean
                            meanCortisol = (validCortisol1 + validCortisol2) / 2;
                        } else if (validCortisol1 !== null) {
                            // Only sensor 1 has data
                            meanCortisol = validCortisol1;
                        } else if (validCortisol2 !== null) {
                            // Only sensor 2 has data
                            meanCortisol = validCortisol2;
                        }
                        
                        // Add the mean cortisol value to the data if we have at least one valid reading
                        if (meanCortisol !== null) {
                            cortisolData.push({
                                username: username,
                                userID: userInfo.device_info ? userInfo.device_info.userID : null,
                                deviceID: userInfo.device_info ? userInfo.device_info.deviceID : null,
                                timestamp: timestamp,
                                value: meanCortisol,
                                sensor: 'mean', // Indicate this is the mean of both sensors
                                cortisol1: validCortisol1, // Keep original values for reference
                                cortisol2: validCortisol2
                            });
                        }
                    });
                }
            }
        } catch (userError) {
            console.warn(`Could not fetch cortisol data for user ${username}:`, userError.message);
        }
        
        // Sort by timestamp
        cortisolData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        console.log('=== User Cortisol AGP Final Results ===');
        console.log('Total cortisol data points for', username, ':', cortisolData.length);
        
        // Get applicable ranges for this user
        let customRanges = null;
        try {
            const configCollection = db.collection('biomarker_configs');
            const configDoc = await configCollection.findOne({ type: 'biomarker_ranges' });
            
            if (configDoc && configDoc.configs.cortisol && userInfo.personal_information) {
                const personalInfo = userInfo.personal_information;
                const deviceInfo = userInfo.device_info;
                const applicableConditions = [];

                // Check for applicable conditions
                if (personalInfo.pregnant === true) applicableConditions.push('pregnancy');
                if (personalInfo.Diabete === true || personalInfo.diabete === true || personalInfo.diabetes === true) {
                    applicableConditions.push('type2_diabetes');
                }
                if (personalInfo.smokes === true) applicableConditions.push('smoking');
                if (personalInfo.drinks === true) applicableConditions.push('drinking');
                if (personalInfo['High BP'] === true || personalInfo.hypertension === true) {
                    applicableConditions.push('hypertension');
                }
                
                const age = deviceInfo?.age || personalInfo.age;
                if (age && (parseInt(age) < 18 || age < 18)) {
                    applicableConditions.push('pediatric');
                }

                // Get custom ranges if conditions apply
                if (applicableConditions.length > 0) {
                    const biomarkerConfig = configDoc.configs.cortisol;
                    const applicableRanges = [];
                    
                    for (const condition of applicableConditions) {
                        if (biomarkerConfig.conditions[condition]) {
                            applicableRanges.push(biomarkerConfig.conditions[condition].ranges);
                        }
                    }
                    
                    if (applicableRanges.length > 0) {
                        if (applicableRanges.length === 1) {
                            customRanges = applicableRanges[0];
                        } else {
                            // Average the ranges across multiple conditions
                            customRanges = averageRanges(applicableRanges, 'cortisol');
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Could not fetch custom ranges for cortisol AGP, using defaults:', error.message);
        }

        // Calculate cortisol statistics and percentiles
        const agpResult = calculateCortisolStatistics(cortisolData, customRanges);
        
        res.json({
            ...agpResult,
            patientInfo: {
                name: username,
                userID: userInfo.device_info?.userID,
                deviceID: userInfo.device_info?.deviceID,
                gender: userInfo.device_info?.gender || 'Unknown',
                age: userInfo.device_info?.age || 'Unknown',
                device: userInfo.device_info?.deviceID || 'CGM Device'
            }
        });
        
    } catch (error) {
        console.error('=== ERROR in user-specific cortisol AGP data endpoint ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to fetch cortisol data for AGP analysis' });
    }
});

// GET /api/population-analysis
// Returns aggregated population statistics for different user groups
app.get('/api/population-analysis', authenticateToken, async (req, res) => {
    try {
        console.log('=== Starting Population Analysis ===');
        
        // Get all users accessible to this user
        const accessibleUsernames = await getAccessibleUsers(req.user);
        console.log(`Found ${accessibleUsernames.length} accessible usernames for population analysis`);
        console.log('Accessible usernames:', accessibleUsernames);
        
        // Get full user data for accessible users
        const allData = await getFileTrackerData();
        const accessibleUsers = allData.filter(user => accessibleUsernames.includes(user.username));
        
        console.log(`Found ${accessibleUsers.length} accessible users with full data for population analysis`);
        console.log('Accessible users:', accessibleUsers.map(u => u.username));
        
        if (accessibleUsers.length === 0) {
            console.log('No accessible users found, returning empty data');
            return res.json({
                general: { userCount: 0, averageTimeInTarget: 0, averageTimeHigh: 0, averageTimeVeryHigh: 0, averageTimeLow: 0, averageTimeVeryLow: 0 },
                diabetes: { userCount: 0, averageTimeInTarget: 0, averageTimeHigh: 0, averageTimeVeryHigh: 0, averageTimeLow: 0, averageTimeVeryLow: 0 },
                pregnancy: { userCount: 0, averageTimeInTarget: 0, averageTimeHigh: 0, averageTimeVeryHigh: 0, averageTimeLow: 0, averageTimeVeryLow: 0 },
                overall: { averageTimeInTarget: 0 },
                dateRange: 'No Data'
            });
        }

        const db = client.db('s3-mongodb-db');
        const dataCollection = db.collection('s3-mongodb-data-entries');
        const configCollection = db.collection('biomarker_configs');
        
        // Get biomarker configuration
        const configDoc = await configCollection.findOne({ type: 'biomarker_ranges' });
        
        // Initialize population groups
        const populations = {
            general: [],
            diabetes: [],
            pregnancy: []
        };
        
        let earliestDate = null;
        let latestDate = null;
        
        // Process each accessible user
        for (const userInfo of accessibleUsers) {
            try {
                // Get glucose data for this user
                const glucoseData = [];
                
                if (userInfo.etag) {
                    const sensorDataResponse = await dataCollection.findOne({ etag: userInfo.etag });
                    
                    if (sensorDataResponse) {
                        let dataPoints = [];
                        if (sensorDataResponse.data && sensorDataResponse.data.data_points) {
                            dataPoints = sensorDataResponse.data.data_points;
                        } else if (sensorDataResponse.data_snapshot && sensorDataResponse.data_snapshot.data_points) {
                            dataPoints = sensorDataResponse.data_snapshot.data_points;
                        }
                        
                        // Process glucose data points
                        dataPoints.forEach(point => {
                            let timestamp;
                            try {
                                if (point.timestamp && point.timestamp.$date && point.timestamp.$date.$numberLong) {
                                    timestamp = new Date(parseInt(point.timestamp.$date.$numberLong));
                                } else if (point.timestamp && point.timestamp.$date) {
                                    timestamp = new Date(point.timestamp.$date);
                                } else if (point.timestamp) {
                                    timestamp = new Date(point.timestamp);
                                } else if (point.time) {
                                    const timeValue = point.time.$numberInt || point.time;
                                    timestamp = new Date(parseInt(timeValue) * 1000);
                                } else {
                                    timestamp = new Date();
                                }
                            } catch (error) {
                                timestamp = new Date();
                            }

                            // Track date range
                            if (!earliestDate || timestamp < earliestDate) earliestDate = timestamp;
                            if (!latestDate || timestamp > latestDate) latestDate = timestamp;

                            const glucose1 = point['Glucose(mg/dL)'] && (point['Glucose(mg/dL)'].$numberDouble || point['Glucose(mg/dL)']);
                            const glucose2 = point['Glucose(mg/dL)_2'] && (point['Glucose(mg/dL)_2'].$numberDouble || point['Glucose(mg/dL)_2']);
                            
                            const validGlucose1 = (glucose1 !== null && glucose1 !== undefined && !isNaN(glucose1)) ? parseFloat(glucose1) : null;
                            const validGlucose2 = (glucose2 !== null && glucose2 !== undefined && !isNaN(glucose2)) ? parseFloat(glucose2) : null;
                            
                            let meanGlucose = null;
                            if (validGlucose1 !== null && validGlucose2 !== null) {
                                meanGlucose = (validGlucose1 + validGlucose2) / 2;
                            } else if (validGlucose1 !== null) {
                                meanGlucose = validGlucose1;
                            } else if (validGlucose2 !== null) {
                                meanGlucose = validGlucose2;
                            }
                            
                            if (meanGlucose !== null) {
                                glucoseData.push({
                                    timestamp: timestamp,
                                    value: meanGlucose
                                });
                            }
                        });
                    }
                }
                
                // Only process users with sufficient data
                console.log(`User ${userInfo.username}: ${glucoseData.length} glucose data points`);
                if (glucoseData.length < 10) {
                    console.log(`Skipping ${userInfo.username} - insufficient data (${glucoseData.length} points)`);
                    continue;
                }
                
                // Determine user's conditions
                const personalInfo = userInfo.personal_information || {};
                const deviceInfo = userInfo.device_info || {};
                
                const isPregnant = personalInfo.pregnant === true;
                const hasDiabetes = personalInfo.Diabete === true || personalInfo.diabete === true || personalInfo.diabetes === true;
                
                console.log(`User ${userInfo.username} conditions: pregnant=${isPregnant}, diabetes=${hasDiabetes}`);
                
                // Get applicable custom ranges
                let customRanges = null;
                if (configDoc && configDoc.configs.glucose) {
                    const applicableConditions = [];
                    
                    if (isPregnant) applicableConditions.push('pregnancy');
                    if (hasDiabetes) applicableConditions.push('type2_diabetes');
                    if (personalInfo.smokes === true) applicableConditions.push('smoking');
                    if (personalInfo.drinks === true) applicableConditions.push('drinking');
                    if (personalInfo['High BP'] === true || personalInfo.hypertension === true) {
                        applicableConditions.push('hypertension');
                    }
                    
                    const age = deviceInfo?.age || personalInfo.age;
                    if (age && (parseInt(age) < 18 || age < 18)) {
                        applicableConditions.push('pediatric');
                    }

                    if (applicableConditions.length > 0) {
                        const biomarkerConfig = configDoc.configs.glucose;
                        const applicableRanges = [];
                        
                        for (const condition of applicableConditions) {
                            if (biomarkerConfig.conditions[condition]) {
                                applicableRanges.push(biomarkerConfig.conditions[condition].ranges);
                            }
                        }
                        
                        if (applicableRanges.length > 0) {
                            if (applicableRanges.length === 1) {
                                customRanges = applicableRanges[0];
                            } else {
                                customRanges = averageRanges(applicableRanges, 'glucose');
                            }
                        }
                    }
                }
                
                // Calculate statistics for this user
                const stats = calculateAGPStatistics(glucoseData, customRanges);
                
                // Create user data object
                const userData = {
                    username: userInfo.username,
                    timeInTarget: stats.statistics.percentBetween70And180,
                    timeHigh: stats.statistics.percentAbove180 - stats.statistics.percentAbove250,
                    timeVeryHigh: stats.statistics.percentAbove250,
                    timeLow: stats.statistics.percentBelow70 - stats.statistics.percentBelow54,
                    timeVeryLow: stats.statistics.percentBelow54,
                    isPregnant,
                    hasDiabetes
                };
                
                // Categorize user into populations
                if (isPregnant) {
                    console.log(`Adding ${userInfo.username} to pregnancy population`);
                    populations.pregnancy.push(userData);
                } else if (hasDiabetes) {
                    console.log(`Adding ${userInfo.username} to diabetes population`);
                    populations.diabetes.push(userData);
                } else {
                    console.log(`Adding ${userInfo.username} to general population`);
                    populations.general.push(userData);
                }
                
            } catch (userError) {
                console.warn(`Error processing user ${userInfo.username}:`, userError.message);
            }
        }
        
        // Calculate averages for each population
        const calculatePopulationAverages = (userArray) => {
            if (userArray.length === 0) {
                return {
                    userCount: 0,
                    averageTimeInTarget: 0,
                    averageTimeHigh: 0,
                    averageTimeVeryHigh: 0,
                    averageTimeLow: 0,
                    averageTimeVeryLow: 0
                };
            }
            
            const sums = userArray.reduce((acc, user) => ({
                timeInTarget: acc.timeInTarget + user.timeInTarget,
                timeHigh: acc.timeHigh + user.timeHigh,
                timeVeryHigh: acc.timeVeryHigh + user.timeVeryHigh,
                timeLow: acc.timeLow + user.timeLow,
                timeVeryLow: acc.timeVeryLow + user.timeVeryLow
            }), { timeInTarget: 0, timeHigh: 0, timeVeryHigh: 0, timeLow: 0, timeVeryLow: 0 });
            
            const count = userArray.length;
            return {
                userCount: count,
                averageTimeInTarget: Math.round((sums.timeInTarget / count) * 10) / 10,
                averageTimeHigh: Math.round((sums.timeHigh / count) * 10) / 10,
                averageTimeVeryHigh: Math.round((sums.timeVeryHigh / count) * 10) / 10,
                averageTimeLow: Math.round((sums.timeLow / count) * 10) / 10,
                averageTimeVeryLow: Math.round((sums.timeVeryLow / count) * 10) / 10
            };
        };
        
        const generalStats = calculatePopulationAverages(populations.general);
        const diabetesStats = calculatePopulationAverages(populations.diabetes);
        const pregnancyStats = calculatePopulationAverages(populations.pregnancy);
        
        // Calculate overall average
        const allUsers = [...populations.general, ...populations.diabetes, ...populations.pregnancy];
        const overallStats = calculatePopulationAverages(allUsers);
        
        // Format date range
        let dateRange = 'No Data';
        if (earliestDate && latestDate) {
            const formatDate = (date) => {
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            };
            dateRange = `${formatDate(earliestDate)} - ${formatDate(latestDate)}`;
        }
        
        console.log('=== Population Analysis Results ===');
        console.log('General population:', generalStats);
        console.log('Diabetes population:', diabetesStats);
        console.log('Pregnancy population:', pregnancyStats);
        console.log('Overall:', overallStats);
        
        res.json({
            general: generalStats,
            diabetes: diabetesStats,
            pregnancy: pregnancyStats,
            overall: { averageTimeInTarget: overallStats.averageTimeInTarget },
            dateRange: dateRange
        });
        
    } catch (error) {
        console.error('=== ERROR in population analysis endpoint ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Failed to fetch population analysis data' });
    }
});


// Connect to MongoDB when starting the server
app.listen(port, async () => {
    try {
        await client.connect();
        console.log(`Server running at http://localhost:${port}`);
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
    }
});
