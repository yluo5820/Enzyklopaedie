export interface Subject {
    id: number;
    name: string;
    parentId?: number;
}
export interface Book {
    id: number;
    title: string;
    authorId: number;
    subjectIds: number[];
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
    speakerId: number | string;
    subjectIds: number[];
    year: number;
    duration?: number;
    link?: string;
}
export interface Author {
    id: number;
    name: string;
    yearOfBirth?: number;
    yearOfDeath?: number;
    countryId?: number;
    description?: string;
    imageUrl?: string;
    link?: string;
    subjectIds?: number[];
}
export interface Nation {
    id: number;
    name: string;
    beginYear?: number;
    endYear?: number;
    description?: string;
    imageUrl?: string;
    link?: string;
    authorIds?: number[];
    civilizationId?: number;
    eraIds?: number[];
}
export interface Civilization {
    id: number;
    name: string;
    nationIds?: number[];
    description?: string;
    parentId?: number;
}
export interface Era {
    id: number;
    name: string;
    beginYear?: number;
    endYear?: number;
    description?: string;
    civilizationId?: number;
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
export type NewAuthor = Omit<Author, 'id'>;
export type UpdateAuthor = Partial<Omit<Author, 'id'>>;
export type NewNation = Omit<Nation, 'id'>;
export type UpdateNation = Partial<Omit<Nation, 'id'>>;
export type NewCivilization = Omit<Civilization, 'id'>;
export type UpdateCivilization = Partial<Omit<Civilization, 'id'>>;
export type NewEra = Omit<Era, 'id'>;
export type UpdateEra = Partial<Omit<Era, 'id'>>;
export type NewNote = Omit<Note, 'id'>;
export type UpdateNote = Partial<Omit<Note, 'id'>>;
export type NewComment = Omit<Comment, 'id'>;
export type UpdateComment = Partial<Omit<Comment, 'id'>>;
