import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import WebSocket, { Server as WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { TeamRequestBody, QuestionRequestBody, User, LoginRequestBody } from './interfaces';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const wss = new WebSocketServer({ port: 8080 });

app.use(express.json());

app.post('/lock-all-teams', async (req: Request, res: Response) => {
    try {
        await prisma.teams.updateMany({
            data: { locked: true }
        });
        res.status(200).json({ message: 'All teams locked successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/unlock-all-teams', async (req: Request, res: Response) => {
    try {
        await prisma.teams.updateMany({
            data: { locked: false }
        });
        res.status(200).json({ message: 'All teams unlocked successfully.' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/register-team', async (req: Request<{}, {}, TeamRequestBody>, res: Response) => {
    const { team_name, team_password, users } = req.body;
    try {
        const existingTeam = await prisma.teams.findUnique({
            where: { team_name },
        });
        if (existingTeam) {
            return res.status(400).json({ error: 'Team name already exists' });
        }
        const newTeam = await prisma.teams.create({
            data: {
                team_id: crypto.randomUUID(),
                team_name,
                team_password,
                users: {
                    create: users.map(user => ({
                        EnrollNo: user.EnrollNo,
                        name: user.name
                    }))
                }
            },
            include: {
                users: true
            }
        });
        res.status(201).json(newTeam);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

app.post('/add-question', async (req: Request<{}, {}, QuestionRequestBody>, res: Response) => {
    const { question_text, question_description, answer } = req.body;
    try {
        const question = await prisma.questions.create({
            data: {
                question_id: crypto.randomUUID(),
                question_text,
                question_description,
                answer
            }
        });
        res.status(201).json(question);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

app.post('/login-team', async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
    const { team_name, team_password } = req.body;
    try {
        const team = await prisma.teams.findFirst({
            where: {
                team_name,
                team_password,
            },
        });
        if (!team) {
            return res.status(401).json({ error: 'Invalid team name or password' });
        }
        res.status(200).json({ message: 'Login successful', team_id: team.team_id });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/submit-answer', async (req: Request, res: Response) => {
    const { team_id, question_id, answer } = req.body;
    try {
        const teamProgress = await prisma.team_progress.findFirst({
            where: { team_id, question_id },
            include: { question: true }
        });
        if (!teamProgress) {
            return res.status(404).json({ message: 'Question not found or no progress for this team.' });
        }
        if (teamProgress.is_completed) {
            return res.status(400).json({ message: 'Question already completed.' });
        }
        if (teamProgress.question.answer.toLowerCase() === answer.toLowerCase()) {
            await prisma.team_progress.update({
                where: { team_id_question_id: { team_id, question_id } },
                data: { is_completed: true, solved_at: new Date() }
            });
            return res.status(200).json({ message: 'Correct answer! Question marked as completed.' });
        }
        return res.status(400).json({ message: 'Incorrect answer.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/get-questions', async (req: Request, res: Response) => {
    try {
        const questions = await prisma.questions.findMany({
            select: {
                question_id: true,
                question_text: true,
                question_description: true
            }
        });
        res.status(200).json(questions);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/lock-team', async (req: Request, res: Response) => {
    const { team_name } = req.body;
    try {
        const team = await prisma.teams.update({
            where: { team_name },
            data: { locked: true }
        });
        res.status(200).json({ message: `Team ${team_name} has been locked.` });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    ws.on('message', async (message: string) => {
        const data = JSON.parse(message);

        if (data.type === 'hint') {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'hint', hint: data.hintText }));
                }
            });
        }

        if (data.type === 'lock' || data.type === 'unlock') {
            const isLocking = data.type === 'lock';
            const teamName = data.team_name;
            try {
                await prisma.teams.update({
                    where: { team_name: teamName },
                    data: { locked: isLocking }
                });
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: data.type, team_name: teamName, message: `Team ${teamName} ${isLocking ? 'locked' : 'unlocked'}!` }));
                    }
                });
            } catch (error) {
                console.error(`Error ${data.type} team:`, error);
                ws.send(JSON.stringify({ message: `Failed to ${data.type} team ${teamName}` }));
            }
        }

        if (data.type === 'lock_all' || data.type === 'unlock_all') {
            const isLockingAll = data.type === 'lock_all';
            try {
                await prisma.teams.updateMany({
                    data: { locked: isLockingAll }
                });
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: data.type, message: `All teams ${isLockingAll ? 'locked' : 'unlocked'}!` }));
                    }
                });
            } catch (error) {
                console.error(`Error ${data.type} all teams:`, error);
                ws.send(JSON.stringify({ message: `Failed to ${data.type} all teams` }));
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
