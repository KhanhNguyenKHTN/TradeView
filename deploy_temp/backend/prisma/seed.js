"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const categories = [
        { code: client_1.AssetCategoryCode.GOLD, name: 'Vàng', isEnabled: true },
        { code: client_1.AssetCategoryCode.SAVING, name: 'Tiết kiệm', isEnabled: true },
        { code: client_1.AssetCategoryCode.STOCK, name: 'Chứng khoán', isEnabled: false },
        { code: client_1.AssetCategoryCode.COIN, name: 'Coin', isEnabled: false },
    ];
    for (const category of categories) {
        await prisma.assetCategory.upsert({
            where: { code: category.code },
            update: { name: category.name, isEnabled: category.isEnabled },
            create: category,
        });
    }
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map