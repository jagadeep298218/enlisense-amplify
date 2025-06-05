const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Parser } = require('json2csv');

const app = express();
const port = 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variable

app.use(cors());
app.use(express.json());

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


async function getFileTrackerData() {
    const db = client.db('s3-mongodb-db');
    const collection = db.collection('s3-mongodb-file_tracker');
    const data = await collection.find({}).toArray();
    return data;
}

async function getUserVersions(patientId) {
    const db = client.db('s3-mongodb-db');
    const collection = db.collection('s3-mongodb-data-versions');
    return await collection.find({ patient_id: patientId }).sort({ versioned_at: -1 }).toArray();
}

async function findUser(username) {
    const db = client.db('s3-mongodb-db');
    const collection = db.collection('s3-mongodb-file_tracker');
    return await collection.findOne({ username: username });
}

async function currentVersion(latestUser) {
    const db = client.db('s3-mongo-db');
    const collection = db.collection('s3-mongodb-data-entires');
    return await collection.findOne({username: latestUser });
}

async function checkUserAccessToPatientId(user, patientId) {
    try {
        const db = client.db('s3-mongodb-db');
        const fileTrackerCollection = db.collection('s3-mongodb-file_tracker');
        
        // Look for files that contain this patientId in their path and belong to this user
        const fileRecord = await fileTrackerCollection.findOne({
            username: user.username,
            _id: { $regex: patientId, $options: 'i' }
        });
        
        return !!fileRecord;
    } catch (error) {
        console.error('Error checking user access to patient_id:', error);
        return false;
    }
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


// Connect to MongoDB when starting the server
app.listen(port, async () => {
    try {
        await client.connect();
        console.log(`Server running at http://localhost:${port}`);
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
    }
});
