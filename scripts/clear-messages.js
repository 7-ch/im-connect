
import prisma from '../server/db.js';

async function main() {
    console.log('🧹 Clearing chat history (Messages & Conversations)...');

    // Delete in order to respect foreign key constraints
    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`- Deleted ${deletedMessages.count} messages.`);

    const deletedConversations = await prisma.conversation.deleteMany({});
    console.log(`- Deleted ${deletedConversations.count} conversations.`);

    console.log('✅ Chat history cleared.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
