import { AssetCategoryCode, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { code: AssetCategoryCode.GOLD, name: 'Vàng', isEnabled: true },
    { code: AssetCategoryCode.SAVING, name: 'Tiết kiệm', isEnabled: true },
    { code: AssetCategoryCode.STOCK, name: 'Chứng khoán', isEnabled: false },
    { code: AssetCategoryCode.COIN, name: 'Coin', isEnabled: false },
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