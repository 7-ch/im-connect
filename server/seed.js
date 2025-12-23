
import prisma from './db.js';

// Initialization: Seed Data if empty
export async function seed() {
    try {
        const count = await prisma.user.count();
        if (count === 0) {
            console.log('Seeding initial data...');
            // Experts

            await prisma.user.create({
                data: {
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
                }
            });

            // Enterprises
            await prisma.user.create({
                data: {
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
                }
            });

        }
    } catch (e) {
        console.error('Seed failed:', e);
    }
}
