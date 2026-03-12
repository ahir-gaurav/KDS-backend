const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const test = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const email = 'iamgauravyaduvanshi@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        console.log('Found user:', user._id);
        console.log('Current Name:', user.name);
        console.log('Current Phone:', user.phone);

        user.name = 'Gaurav Yadav updated';
        user.phone = '1234567891';

        console.log('Attempting to save...');
        await user.save();
        console.log('Save successful!');

        process.exit(0);
    } catch (error) {
        console.error('Save failed!');
        console.error(error);
        process.exit(1);
    }
};

test();
