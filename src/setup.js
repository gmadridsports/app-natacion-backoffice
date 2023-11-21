import inquirer from 'inquirer';
import fs from 'fs';
import { URL } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;

inquirer
    .prompt([
        {
            type: 'input',
            name: 'serviceAccountKeyPath',
            message: "Service Account Path: ",
            validate(value) {
                try {
                    const statsForPath = fs.statSync(value);
                    if (!statsForPath.isFile()) {
                        return 'Please enter a valid file path';
                    }

                } catch (err) {
                    return 'Please enter a valid file path';
                }
                return true;
            },
        },
        {
            type: 'input',
            name: 'supabaseAccessToken',
            message: "Supabase admin access token: ",
            validate(value) {
                try {
                    const isValidJWT = /^[A-Za-z0-9_-]{2,}(?:\.[A-Za-z0-9_-]{2,}){2}$/.test(value);

                    if (!isValidJWT) {
                        return 'Please enter a valid JWT Token';
                    }

                } catch (err) {
                    return 'Please enter a valid JWT Token';
                }
                return true;
            },
        },
        {
            type: 'input',
            name: 'supabaseUrl',
            message: "Supabase URL: ",
            validate(value) {
                try {
                    const url = new URL(value);
                    if (!url) {
                        return 'Please enter a valid URL';
                    }

                } catch (err) {
                    return 'Please enter a valid URL';
                }
                return true;
            },
        }
    ])
    .then((answers) => {
        const { serviceAccountKeyPath, supabaseAccessToken } = answers;
        fs.writeFileSync(`${__dirname}/../dev/serviceAccountKeyPath`, serviceAccountKeyPath);
        fs.writeFileSync(`${__dirname}/../dev/supabaseAccessToken`, supabaseAccessToken);
        fs.writeFileSync(`${__dirname}/../dev/supabaseUrl`, answers.supabaseUrl);

        // Use user feedback for... whatever!!
        console.log("Successfully set up.");
    })
    .catch((error) => {
        if (error.isTtyError) {
            console.error('An unexpected error occurred: ', error);
            process.exit(1);
        } else {
            console.error('An unexpected error occurred: ', error);
            process.exit(1);
        }
    });