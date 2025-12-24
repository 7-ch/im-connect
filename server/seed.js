import prisma from './db.js';

// Initialization: Seed Data with robust upsert and mock chat
export async function seed() {
    try {
        console.log('🌱 Starting database seeding...');

        // 1. Define Users
        const expertData = {
            username: 'lawyer',
            password: '123456',
            name: '王律师',
            role: 'expert',
            title: '资深法律顾问',
            organization: '正义律师事务所',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lawyer&eyebrows=default',
            bio: '执业律师，法学硕士。专注于公司法、合同法及企业合规体系建设。担任多家大型企业常年法律顾问，擅长处理商业合同纠纷、股权架构设计及劳动争议解决。',
            specialty: '合同纠纷,股权设计,企业合规,劳动争议',
            mobile: '13900139002'
        };

        const enterpriseData = {
            username: 'client',
            password: '123456',
            name: '张总',
            role: 'enterprise',
            title: '总经理',
            organization: '未来科技股份有限公司',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ent1&glasses=prescription02',
            mobile: '13700137003',
            enterpriseType: 'Technology',
            address: '浙江省杭州市余杭区梦想小镇互联网村1号',
            latitude: 30.29,
            longitude: 120.01,
            creditCode: '91330110MA28D00004'
        };

        // 2. Upsert Users (Create if not exists, update if exists)
        const expert = await prisma.user.upsert({
            where: { username: expertData.username },
            update: expertData,
            create: expertData,
        });

        const enterprise = await prisma.user.upsert({
            where: { username: enterpriseData.username },
            update: enterpriseData,
            create: enterpriseData,
        });

        console.log(`✅ Users verified: ${expert.name} & ${enterprise.name}`);

        // 3. Check for existing conversation to avoid duplicate seeding on every restart
        // However, for a "reset" or "demo" feel, we might want to ensure the specific messages exist.
        // For now, we will clear old messages between THESE two users to ensure a clean demo state.

        await prisma.message.deleteMany({
            where: {
                OR: [
                    { senderId: expert.id, receiverId: enterprise.id },
                    { senderId: enterprise.id, receiverId: expert.id }
                ]
            }
        });

        await prisma.conversation.deleteMany({
            where: {
                OR: [
                    { userId: expert.id, participantId: enterprise.id },
                    { userId: enterprise.id, participantId: expert.id }
                ]
            }
        });

        // 4. Create Conversations
        await prisma.conversation.create({
            data: {
                userId: enterprise.id,
                participantId: expert.id,
                unreadCount: 0,
                updatedAt: new Date()
            }
        });

        await prisma.conversation.create({
            data: {
                userId: expert.id,
                participantId: enterprise.id,
                unreadCount: 0,
                updatedAt: new Date()
            }
        });

        // 5. Insert Messages (Legal Consultation Scenario)
        const baseTime = new Date();
        baseTime.setHours(baseTime.getHours() - 2); // Start 2 hours ago

        const messages = [
            {
                sender: enterprise,
                content: '王律师，早。我们正在谈的一笔A轮融资，对方发来了Term Sheet（投资条款清单），有些条款我看着有点拿不准，想请你把把关。',
                type: 'text',
                offsetMinutes: 0
            },
            {
                sender: enterprise,
                type: 'file',
                content: '未来科技_A轮投资条款清单_v1.pdf',
                fileName: '未来科技_A轮投资条款清单_v1.pdf',
                fileSize: '2.8 MB',
                offsetMinutes: 1
            },
            {
                sender: expert,
                content: '张总早。收到了，我马上看。具体是哪几条您觉得有疑虑？',
                type: 'text',
                offsetMinutes: 5
            },
            {
                sender: enterprise,
                content: '主要是“一票否决权”和“回购条款”这块。对方要求对公司年度预算有一票否决权，我觉得这会影响经营效率。还有如果3年没上市要求10%年化回购，压力有点大。',
                type: 'text',
                offsetMinutes: 8
            },
            {
                sender: expert,
                content: '明白了。年度预算的一票否决确实比较敏感，可以在补充协议里约定“仅限于超出上年度预算30%以上”的重大调整才拥有否决权，这样能保障咱们的经营灵活性。',
                type: 'text',
                offsetMinutes: 15
            },
            {
                sender: expert,
                content: '至于回购条款，3年上市对于科技型初创企业来说确实比较紧迫。建议争取改为5年，或者将触发回购的条件限定在“实质性违约”或“创始人重大过失”上，而不是单纯的时间线。',
                type: 'text',
                offsetMinutes: 18
            },
            {
                sender: enterprise,
                content: '有道理！这两个建议很好。另外关于董事会席位，他们想要两席，这会不会导致我们失去控制权？',
                type: 'text',
                offsetMinutes: 22
            },
            {
                sender: expert,
                content: '只要您和创始团队保持董事会过半数席位（例如5席占3席），且没有设置过多的“一致行动人”条款，控制权基本是安全的。我会把详细的修改意见批注在文件里发给您。',
                type: 'text',
                offsetMinutes: 26
            },
            {
                sender: expert,
                type: 'file',
                content: '未来科技_A轮投资条款清单_法律意见书_v1.docx',
                fileName: '未来科技_A轮投资条款清单_法律意见书_v1.docx',
                fileSize: '1.2 MB',
                offsetMinutes: 45
            },
            {
                sender: enterprise,
                content: '辛苦了！我这就按您的意见跟投资方沟通。',
                type: 'text',
                offsetMinutes: 50
            }
        ];

        for (const msg of messages) {
            const timestamp = new Date(baseTime.getTime() + msg.offsetMinutes * 60000);
            const receiver = msg.sender.id === expert.id ? enterprise : expert;

            await prisma.message.create({
                data: {
                    senderId: msg.sender.id,
                    receiverId: receiver.id,
                    content: msg.content,
                    type: msg.type,
                    fileName: msg.fileName,
                    fileSize: msg.fileSize,
                    status: 'read',
                    timestamp: timestamp
                }
            });
        }

        // Update updated_at of conversations
        const lastMsgTime = new Date(baseTime.getTime() + 50 * 60000);
        await prisma.conversation.updateMany({
            where: {
                OR: [
                    { userId: expert.id, participantId: enterprise.id },
                    { userId: enterprise.id, participantId: expert.id }
                ]
            },
            data: {
                updatedAt: lastMsgTime
            }
        });

        console.log('✅ Default chat data seeded.');

    } catch (e) {
        console.error('Seed failed:', e);
    }
}
