import {
  ChevronRight,
  Ellipsis,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Group, GroupNote } from '../../components/Group'
import { IconButton } from '../../components/IconButton'
import { PanelView } from '../../components/PanelView'
import { ConfirmDelete, MenuItem, Popover } from '../../components/Popover'
import { QuickAdd } from '../../components/QuickAdd'
import { sortTasks } from '../../data/taskStore'
import type {
  CustomTaskList,
  TaskSortMode,
  TaskStore,
} from '../../data/taskStore'
import { TaskRows } from '../TaskRows'

export interface ListsViewProps {
  store: TaskStore
  sortMode: TaskSortMode
  showCompleted: boolean
  now: number
  /** The open list, or undefined for the index. Held in the route. */
  listId?: string
  onOpenList(listId: string | undefined): void
}

/** Lists: an index of the custom lists, and one list at a time in detail. */
export function ListsView(props: ListsViewProps) {
  const list = props.store.customLists.find((item) => item.id === props.listId)

  return list ? (
    <ListDetail key={list.id} {...props} list={list} />
  ) : (
    <ListIndex {...props} />
  )
}

function ListIndex({ store, onOpenList }: ListsViewProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const count = store.customLists.length

  const create = () => {
    const id = store.addList(draft)

    if (id) {
      setDraft('')
      setIsCreating(false)
      onOpenList(id)
    }
  }

  return (
    <PanelView
      id="lists"
      title="All lists"
      aside={`${count} ${count === 1 ? 'list' : 'lists'}`}
      actions={
        <IconButton
          label="New list"
          aria-expanded={isCreating}
          onClick={() => setIsCreating((current) => !current)}
        >
          <Plus aria-hidden="true" />
        </IconButton>
      }
    >
      {isCreating ? (
        <div className="sn-field sn-inline-field">
          <span className="sn-margin-cell" aria-hidden="true">
            <Plus />
          </span>
          <input
            type="text"
            aria-label="Create a custom list"
            placeholder="List name"
            value={draft}
            autoFocus
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                create()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setDraft('')
                setIsCreating(false)
              }
            }}
          />
          <button
            type="button"
            className="sn-chip"
            disabled={!draft.trim()}
            onClick={create}
          >
            Create list
          </button>
        </div>
      ) : null}
      {count > 0 ? (
        <Group>
          {store.customLists.map((list) => {
            const openCount = list.tasks.filter((task) => !task.done).length

            return (
              <button
                type="button"
                key={list.id}
                className="sn-row sn-row-nav"
                aria-label={`Open ${list.title}, ${openCount} open`}
                onClick={() => onOpenList(list.id)}
              >
                <span className="sn-margin-cell sn-row-value">{openCount}</span>
                <span className="sn-row-title" title={list.title}>
                  {list.title}
                </span>
                {list.showOnToday ? (
                  <Pin className="sn-row-pin" aria-label="Shown on Today" />
                ) : null}
                <ChevronRight aria-hidden="true" />
              </button>
            )
          })}
        </Group>
      ) : !isCreating ? (
        <GroupNote>No lists yet. Make one with the plus above.</GroupNote>
      ) : null}
    </PanelView>
  )
}

function ListDetail({
  store,
  sortMode,
  showCompleted,
  now,
  list,
  onOpenList,
}: ListsViewProps & { list: CustomTaskList }) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState(list.title)
  const [layer, setLayer] = useState<'none' | 'menu' | 'confirm'>('none')
  const [completedOpen, setCompletedOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const taskRef = useMemo(
    () => ({ source: 'custom' as const, listId: list.id }),
    [list.id],
  )
  const { open, done } = useMemo(() => {
    const sorted = sortTasks(list.tasks, sortMode)

    return {
      open: sorted.filter((task) => !task.done),
      done: sorted.filter((task) => task.done),
    }
  }, [list.tasks, sortMode])
  const showDone = showCompleted && done.length > 0

  const commitRename = () => {
    store.renameList(list.id, titleDraft)
    setIsRenaming(false)
  }
  const deleteList = () => {
    store.deleteList(list.id)
    onOpenList(undefined)
  }

  return (
    <PanelView
      id="list-detail"
      title={list.title}
      subtitle={list.showOnToday ? 'Shown on Today' : undefined}
      aside={`${open.length} open`}
      back={{ label: 'All lists', onBack: () => onOpenList(undefined) }}
      titleEditor={
        isRenaming ? (
          <input
            className="sn-title sn-title-edit"
            type="text"
            aria-label={`Rename ${list.title}`}
            value={titleDraft}
            autoFocus
            autoComplete="off"
            onFocus={(event) => event.currentTarget.select()}
            onBlur={commitRename}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitRename()
              }

              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setIsRenaming(false)
              }
            }}
          />
        ) : undefined
      }
      actions={
        <>
          <IconButton
            ref={moreRef}
            label={`Actions for ${list.title}`}
            aria-haspopup="menu"
            aria-expanded={layer !== 'none'}
            onClick={() =>
              setLayer((current) => (current === 'none' ? 'menu' : 'none'))
            }
          >
            <Ellipsis aria-hidden="true" />
          </IconButton>
          <Popover
            open={layer === 'menu'}
            anchorRef={moreRef}
            role="menu"
            label={`Actions for ${list.title}`}
            onClose={() => setLayer('none')}
          >
            <MenuItem
              icon={<Pencil aria-hidden="true" />}
              onSelect={() => {
                setTitleDraft(list.title)
                setLayer('none')
                setIsRenaming(true)
              }}
            >
              Rename list
            </MenuItem>
            <MenuItem
              icon={<Pin aria-hidden="true" />}
              checked={Boolean(list.showOnToday)}
              onSelect={() => {
                store.toggleListOnToday(list.id)
                setLayer('none')
              }}
            >
              Show on Today
            </MenuItem>
            <MenuItem
              icon={<Trash2 aria-hidden="true" />}
              tone="danger"
              onSelect={({ shiftKey }) => {
                if (shiftKey) {
                  deleteList()
                  return
                }

                setLayer('confirm')
              }}
            >
              Delete list
            </MenuItem>
          </Popover>
          <Popover
            open={layer === 'confirm'}
            anchorRef={moreRef}
            role="alertdialog"
            label={`Confirm delete ${list.title}`}
            onClose={() => setLayer('none')}
          >
            <ConfirmDelete
              question="Delete list and its tasks?"
              onCancel={() => setLayer('none')}
              onConfirm={deleteList}
            />
          </Popover>
        </>
      }
    >
      {open.length > 0 ? (
        <Group>
          <TaskRows store={store} taskRef={taskRef} tasks={open} now={now} />
        </Group>
      ) : null}
      <QuickAdd
        key={`list:${list.id}`}
        ariaLabel={`Add a task to ${list.title}`}
        draftKey={`list:${list.id}`}
        placeholder={`New task in ${list.title}`}
        onSubmit={(title, reminderAt) =>
          store.addTask(taskRef, title, reminderAt)
        }
      />
      {open.length === 0 ? (
        <GroupNote>
          {done.length > 0
            ? 'Everything in this list is complete.'
            : 'No tasks yet. Write the first one above.'}
        </GroupNote>
      ) : null}
      {showDone ? (
        <Group
          label={`Completed · ${done.length}`}
          collapsible={{
            open: completedOpen,
            onToggle: () => setCompletedOpen((current) => !current),
          }}
        >
          <TaskRows store={store} taskRef={taskRef} tasks={done} now={now} />
        </Group>
      ) : null}
    </PanelView>
  )
}
