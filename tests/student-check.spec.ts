import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Загрузка юзеров
function loadUsersFromFile(filePath: string): Array<{
  email: string;
  password: string;
  additionalInfo: string;
}> {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    return lines.map(line => {
      const parts = line.split(' ').filter(part => part.trim() !== '');
      if (parts.length < 2) {
        throw new Error(`Недостаточно данных в строке: ${line}`);
      }
      
      return {
        email: parts[0],
        password: parts[1],
        additionalInfo: parts.slice(2).join(' ') || '' // Объединяем остальные части как доп. сведения
      };
    });
  } catch (error) {
    console.error('Ошибка при чтении файла с пользователями:', error.message);
    return [];
  }
}

async function checkUser(page: any, user: {
  email: string;
  password: string;
  additionalInfo: string;
}): Promise<{
  email: string;
  easyTasks: number;
  mediumTasks: number;
  additionalInfo: string;
  passed: boolean;
  error?: string;
}> {
  try {
    await page.goto('https://sql-academy.org/ru');
    // Вход
    await page.getByText('Войти').click();
    await page.getByTestId('sign-in-form-email-input').fill(user.email);
    await page.getByTestId('sign-in-form-password-input').fill(user.password);
    await page.getByTestId('sign-in-form-submit-button').click();
    
    // Переход к тренажеру
    await page.getByRole('link', { name: 'Тренажёр', exact: true }).click();
    await page.getByText('Решённые', { exact: true }).click();
    
    // Подсчет задач
    const numOfEasyTasks = await page.locator('.difficulty-indicator.easy').count();
    const numOfMediumTasks = await page.locator('.difficulty-indicator.medium').count();
    
    const result = {
      email: user.email,
      easyTasks: numOfEasyTasks,
      mediumTasks: numOfMediumTasks,
      additionalInfo: user.additionalInfo,
      passed: numOfEasyTasks >= 16 && numOfMediumTasks >= 11
    };
    
    if (!result.passed) {
      console.log(`Ученик с email ${user.email} не прошёл нужное количество задач:`);
      console.log(`Легкие задачи: ${numOfEasyTasks}/16`);
      console.log(`Средние задачи: ${numOfMediumTasks}/11`);
      if (user.additionalInfo) {
        console.log(`Доп. сведения: ${user.additionalInfo}`);
      }
    } else {
      console.log(`Ученик с email ${user.email} прошёл все необходимые задачи`);
      console.log(`Легкие задачи: ${numOfEasyTasks}/16`);
      console.log(`Средние задачи: ${numOfMediumTasks}/11`);
      if (user.additionalInfo) {
        console.log(`Доп. сведения: ${user.additionalInfo}`);
      }
    }
    
    //Выход
    await page.getByRole('img', { name: 'avatar' }).click();
    await page.getByText('Выйти').click();

    return result;
    
  } catch (error) {
    console.error(`Ошибка при проверке пользователя ${user.email}:`, error.message);
    return {
      email: user.email,
      easyTasks: 0,
      mediumTasks: 0,
      additionalInfo: user.additionalInfo,
      passed: false,
      error: error.message
    };
  }
}

test.describe('Проверка прогресса учеников', () => {
  test('Проверка всех пользователей из файла', async ({ page }) => {
    // Путь к файлу
    const usersFilePath = path.join(process.cwd(), 'users.txt');
    
    const users = loadUsersFromFile(usersFilePath);
    
    if (users.length === 0) {
      console.error('Не найдено ни одного пользователя в файле или файл не существует');
      expect(users.length).toBeGreaterThan(0);
      return;
    }
    
    console.log(`Найдено ${users.length} пользователей для проверки\n`);
    
    const results: Array<{
      email: string;
      easyTasks: number;
      mediumTasks: number;
      additionalInfo: string;
      passed: boolean;
      error?: string;
    }> = [];
    
    // Проверяем юзеров
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`Проверка пользователя ${i + 1}/${users.length}: ${user.email}`);
      
      const result = await checkUser(page, user);
      results.push(result);
      
      console.log(''); 
    }
    
    // Статистика
    console.log('ИТОГОВАЯ СТАТИСТИКА:');
    console.log('========================');
    
    const passedUsers = results.filter(r => r.passed);
    const failedUsers = results.filter(r => !r.passed);
    
    console.log(`Прошли все требования: ${passedUsers.length}`);
    console.log(`Не прошли требования: ${failedUsers.length}`);
    console.log(`Процент успеха: ${Math.round((passedUsers.length / results.length) * 100)}%`);
    
    if (failedUsers.length > 0) {
      console.log('\n Список учеников, не прошедших требования:');
      failedUsers.forEach(user => {
        console.log(`- ${user.email} - Легкие: ${user.easyTasks}/16, Средние: ${user.mediumTasks}/11`);
      });
    }
    
  });
});