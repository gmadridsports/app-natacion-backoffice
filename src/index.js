import {initializeApp, applicationDefault} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";
import {createClient} from '@supabase/supabase-js'
import inquirer from 'inquirer';
import fs from 'fs';
import {URL} from 'url';
import readline from 'readline';
import InquirerDatePicker from 'inquirer-datepicker-prompt';

const __dirname = new URL('.', import.meta.url).pathname;

console.log('Initializing...');
inquirer.registerPrompt('datetime', InquirerDatePicker);
const ifc = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// GOOGLE_APPLICATION_CREDENTIALS env var from setup
const googleApp = await initializeApp({
    credential: applicationDefault(),
});

const accessToken = fs.readFileSync(`${__dirname}/../dev/supabaseAccessToken`, 'utf8');
const supabaseUrl = fs.readFileSync(`${__dirname}/../dev/supabaseUrl`, 'utf8');

const supabase = createClient(supabaseUrl, accessToken);

console.log('Initialized.');
let answer = null;

while (answer?.action !== 'Exit') {
    answer = await inquirer
        .prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: "What do you wanna do: ",
                    choices: ['Enable a user', 'Upload a training week', new inquirer.Separator(), 'Exit'],
                }
            ]
        );

    switch (answer.action) {
        case 'Enable a user':
            await enableUser();
            break;
        case 'Upload a training week':
            await uploadTrainingWeek();
            break;
        default:
            process.exit(0);
    }
}

async function enableUser() {

    answer = await inquirer
        .prompt([
                {
                    type: 'input',
                    name: 'email',
                    message: "Enter the email you want to enable as member: ",
                    validate: (value) => {
                        const validEmail = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/.test(value);

                        if (!validEmail) {
                            return 'Please enter a valid email';
                        }

                        return true;
                    }
                }
            ]
        );
    const {email} = answer;
    console.log(`Enabling membership for ${email}...`);
    const {data, error} = await supabase.rpc('enable_membership', {email_updating_user: email});
    if (error) {
        console.err('an error occurred: ', error);
        process.exit(1);
    }

    //
    // NOTIFICATION
    //
    console.log(`We got ${data.length} active sessions for this user`);

    for (const token of data) {
        console.log('Sending a welcoming notification...');

        await getMessaging().send({
            notification: {
                title: 'Membresía abrobada',
                body: 'Te damos la bienvenida a GMadrid! 🏊'
            },
            token: token.notification_token
        });
    }

    console.log('New member set! 🎉');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function uploadTrainingWeek() {
    const answer = await inquirer
        .prompt([
            {
                type: 'input',
                name: 'trainingWeekFilePath',
                message: "Path of the new training week: ",
                validate(value) {
                    try {
                        const statsForPath = fs.statSync(value);
                        if (!statsForPath.isFile()) {
                            return 'Please enter a valid file path';
                        }

                        if (!value.endsWith('.pdf')) {
                            return 'Please enter a valid pdf file path';
                        }
                    } catch (err) {
                        return 'Please enter a valid file path';
                    }
                    return true;
                },
            },
            {
                type: 'datetime',
                name: 'startTrainingDate',
                message: 'When is the first training week day?',
                format: ['d', '/', 'm', '/', 'yyyy']
            }
        ]);
    const {startTrainingDate, trainingWeekFilePath} = answer;

    const startDate = new Date(startTrainingDate);
    const endDate = new Date(startTrainingDate);
    endDate.setDate(endDate.getDate() + 6);

    console.log('uploading...');
    const fileToUpload = fs.readFileSync(trainingWeekFilePath);
    const {uploaddata, uploadError} = await supabase
        .storage
        .from('trainings')
        .upload(`general/${startDate.toISOString().split('T')[0]}.pdf`, fileToUpload, {
            cacheControl: '3600',
            upsert: true
        });
    if (uploadError) {
        console.error('An error occured while uploading' + uploadError);
        process.exit(1);
    }


    //
    // NOTIFICATION
    //
    const startDateMonth = capitalize(startDate.toLocaleString("es-ES", {month: "short"}));
    const endDateMonth = capitalize(endDate.toLocaleString("es-ES", {month: "short"}));

    const trainingWeekName = (startDateMonth === endDateMonth) ? `${startDate.getDate()}-${endDate.getDate()} ${startDateMonth}` : `${startDate.getDate()} ${startDateMonth} - ${endDate.getDate()} ${endDateMonth}`;

    const {data: profileData, error: profileError} = await supabase
        .from('profiles')
        .select('id')
        .eq('membership_level', 'member');

    const ids = profileData.map((profile) => profile.id);

    const {data, error} = await supabase
        .from('notification_tokens')
        .select('token')
        .in('user_id', ids);

    console.log('Sending the training notification...');
    console.log(`We got ${data.length} active sessions`);
    for (const {token} of data) {
        if (token === null)
            continue;

        try {
            await getMessaging().send({
                notification: {
                    title: 'Entreno disponible',
                    body: `Semana ${trainingWeekName} disponible 🏊`
                },
                token
            });
        } catch (e) {
        }

        process.stdout.write(`.`);
    }
    console.log('');

    console.log('New training week uploaded! 🎉');
}
