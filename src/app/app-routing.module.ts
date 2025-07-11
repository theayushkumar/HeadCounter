import { TeacherAttendanceComponent } from './teacher-attendance/teacher-attendance.component';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { StudentRegistrationComponent } from './student-registration/student-registration.component';

const routes: Routes = [
  { path: '', component: TeacherAttendanceComponent },
  { path: 'teacher', component: TeacherAttendanceComponent },
  { path: 'student', component: StudentRegistrationComponent },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
