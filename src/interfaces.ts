export interface User {
    EnrollNo: string;
    name: string;
}

export interface TeamRequestBody {
    team_name: string;
    team_password: string;
    users: User[];
}

export interface QuestionRequestBody {
    question_text: string;
    question_description: string;
    answer: string;
}

export interface LoginRequestBody {
    team_name: string;
    team_password: string;
}