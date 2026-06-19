// import { MessageVerifier } from '../verification/MessageVerifier';

// async function test() {
//     const deviceSerial = 'ZA2237FKXH';
//     const recipientNumber = '9876543210';
    
//     const verifier = new MessageVerifier(deviceSerial, recipientNumber);
    
//     console.log('\n Verify Sent Message ');
//     const sent = await verifier.verifyMessageSent('Hello Test');
//     console.log('Result:', sent ? 'PASS' : 'FAIL');
    
//     console.log('\n Thread ID ');
//     const threadId = await verifier.getThreadId(recipientNumber);
//     console.log('Thread ID:', threadId);
//     console.log('Result:', threadId === 16 ? ' PASS' : ' FAIL');
    
//     console.log('\n Received Message ');
//     const senderAddress = '+919640571324';
//     const received = await verifier.verifyMessageReceivedByAddress('Hi', senderAddress);
//     console.log('Result:', received ? ' PASS' : ' FAIL');
    
//     console.log('\n All Sent Messages ');
//     const allSent = await verifier.getAllSentMessages(recipientNumber);
//     console.log(`Found ${allSent.length} sent messages:`);
//     allSent.forEach((msg, idx) => {
//         console.log(`  ${idx + 1}. Body: "${msg.body}", Date: ${msg.date}`);
//     });
//     console.log('Result:', allSent.length  === 3 ? ' PASS' : ' FAIL');
// }

// test().catch(console.error);