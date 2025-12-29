import 'reflect-metadata'
import { AppDataSource } from '../data-source'
import { User, UserRole } from '../entities/User'
import bcrypt from 'bcryptjs'

async function seedAdmin() {
  try {
    await AppDataSource.initialize()
    console.log('Data Source initialized')

    const userRepository = AppDataSource.getRepository(User)

    // Default admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@beauty.com'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

    // Check if admin already exists
    const existingAdmin = await userRepository.findOneBy({ email: adminEmail })
    if (existingAdmin) {
      console.log(`Admin user already exists: ${adminEmail}`)
      console.log('You can login with:')
      console.log(`  Email: ${adminEmail}`)
      console.log(`  Password: ${adminPassword}`)
      await AppDataSource.destroy()
      return
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    const admin = userRepository.create({
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
    })

    await userRepository.save(admin)
    console.log('✅ Admin user created successfully!')
    console.log('\n📧 Admin Credentials:')
    console.log(`   Email: ${adminEmail}`)
    console.log(`   Password: ${adminPassword}`)
    console.log('\n⚠️  Please change the default password after first login!')

    await AppDataSource.destroy()
  } catch (error) {
    console.error('Error seeding admin:', error)
    process.exit(1)
  }
}

seedAdmin()
