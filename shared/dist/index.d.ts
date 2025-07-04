export interface Subject {
    id: number;
    name: string;
    parentId?: number;
}
export interface Book {
    id: number;
    title: string;
    author: string;
    subjectId: number;
    year: number;
    pages?: number;
    isRead: boolean;
    rating?: number;
    coverImageUrl?: string;
    description?: string;
}
export interface Lecture {
    id: number;
    title: string;
    speaker: string;
    subjectId: number;
    year: number;
    duration?: number;
    link?: string;
}
export interface Note {
    id: number;
    parentId: number;
    parentType: 'book' | 'lecture';
    content: string;
    timestamp: string;
}
export interface Comment {
    id: number;
    parentId: number;
    parentType: 'book' | 'lecture';
    content: string;
    timestamp: string;
}
export type NewBook = Omit<Book, 'id'>;
export type UpdateBook = Partial<Omit<Book, 'id'>>;
export type NewSubject = Omit<Subject, 'id'>;
export type UpdateSubject = Partial<Omit<Subject, 'id'>>;
export type NewLecture = Omit<Lecture, 'id'>;
export type UpdateLecture = Partial<Omit<Lecture, 'id'>>;
export type NewNote = Omit<Note, 'id'>;
export type UpdateNote = Partial<Omit<Note, 'id'>>;
export type NewComment = Omit<Comment, 'id'>;
export type UpdateComment = Partial<Omit<Comment, 'id'>>;
