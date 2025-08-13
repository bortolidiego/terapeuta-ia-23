import { useState, useEffect, useCallback } from "react";
import { NotebookPen, Plus, Search, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotesDialog = ({ open, onOpenChange }: NotesDialogProps) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Auto-save delay
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as notas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      loadNotes();
    }
  }, [open, user, loadNotes]);

  const createNewNote = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_notes')
        .insert({
          user_id: user.id,
          title: 'Nova Nota',
          content: ''
        })
        .select()
        .single();

      if (error) throw error;
      
      const newNote = data as Note;
      setNotes(prev => [newNote, ...prev]);
      setSelectedNote(newNote);
      setNoteTitle(newNote.title);
      setNoteContent(newNote.content);
      setEditingTitle(true);

      toast({
        title: "Sucesso",
        description: "Nova nota criada.",
      });
    } catch (error) {
      console.error('Erro ao criar nota:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a nota.",
        variant: "destructive",
      });
    }
  };

  const saveNote = useCallback(async (noteId: string, title: string, content: string) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_notes')
        .update({
          title: title.trim() || 'Nova Nota',
          content: content
        })
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Atualizar a nota local
      setNotes(prev => prev.map(note => 
        note.id === noteId 
          ? { ...note, title: title.trim() || 'Nova Nota', content, updated_at: new Date().toISOString() }
          : note
      ));

      if (selectedNote?.id === noteId) {
        setSelectedNote(prev => prev ? { ...prev, title: title.trim() || 'Nova Nota', content, updated_at: new Date().toISOString() } : null);
      }
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a nota.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, selectedNote]);

  // Auto-save with debounce
  const debouncedSave = useCallback((noteId: string, title: string, content: string) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    const timeout = setTimeout(() => {
      saveNote(noteId, title, content);
    }, 1000);
    setSaveTimeout(timeout);
  }, [saveTimeout, saveNote]);

  const handleTitleChange = (value: string) => {
    setNoteTitle(value);
    if (selectedNote) {
      debouncedSave(selectedNote.id, value, noteContent);
    }
  };

  const handleContentChange = (value: string) => {
    setNoteContent(value);
    if (selectedNote) {
      debouncedSave(selectedNote.id, noteTitle, value);
    }
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setEditingTitle(false);
  };

  const deleteNote = async (note: Note) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_notes')
        .delete()
        .eq('id', note.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== note.id));
      
      if (selectedNote?.id === note.id) {
        setSelectedNote(null);
        setNoteTitle("");
        setNoteContent("");
      }

      toast({
        title: "Sucesso",
        description: "Nota excluída.",
      });
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a nota.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = (note: Note) => {
    setNoteToDelete(note);
    setDeleteConfirmOpen(true);
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <NotebookPen className="h-5 w-5" />
              Minhas Anotações
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex gap-4 min-h-0">
            {/* Lista de notas */}
            <div className="w-1/3 flex flex-col">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nas notas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={createNewNote} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="text-center text-muted-foreground py-8">
                    Carregando notas...
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda. Crie sua primeira nota!'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredNotes.map((note) => (
                      <Card
                        key={note.id}
                        className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                          selectedNote?.id === note.id ? 'border-primary bg-accent/30' : ''
                        }`}
                        onClick={() => selectNote(note)}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-medium text-sm truncate pr-2">
                              {note.title}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(note);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {note.content || 'Nota vazia'}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.updated_at)}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Editor de nota */}
            <div className="flex-1 flex flex-col">
              {selectedNote ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    {editingTitle ? (
                      <Input
                        value={noteTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onBlur={() => setEditingTitle(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setEditingTitle(false);
                          }
                        }}
                        className="font-medium"
                        autoFocus
                      />
                    ) : (
                      <h3 
                        className="font-medium text-lg flex-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setEditingTitle(true)}
                      >
                        {noteTitle || 'Nova Nota'}
                      </h3>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTitle(true)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>

                  <Textarea
                    value={noteContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Escreva sua nota aqui..."
                    className="flex-1 resize-none min-h-[300px]"
                  />

                  {isSaving && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Salvando...
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <NotebookPen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecione uma nota para editar</p>
                    <p className="text-sm mt-1">ou crie uma nova nota</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a nota "{noteToDelete?.title}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noteToDelete) {
                  deleteNote(noteToDelete);
                  setDeleteConfirmOpen(false);
                  setNoteToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};